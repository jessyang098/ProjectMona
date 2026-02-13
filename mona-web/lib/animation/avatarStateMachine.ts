/**
 * Avatar Animation State Machine
 * Ported from Riko's animationManager.js — physics-based head/eye movement
 * with 4 conversation states: idle, listening, thinking, talking.
 *
 * Avatar-agnostic: outputs abstract values that VRM and Live2D adapters
 * translate to their respective parameter systems.
 */

export type AvatarState = "idle" | "listening" | "thinking" | "talking";

export interface StateMachineOutput {
  /** Head nod (pitch). Radians for VRM, degrees-ish for Live2D. */
  headX: number;
  /** Head turn (yaw). */
  headY: number;
  /** Head tilt (roll). */
  headZ: number;
  /** Body sway (lean). */
  bodyX: number;
  /** Eye gaze horizontal (-1 left, +1 right). */
  eyeX: number;
  /** Eye gaze vertical (-1 down, +1 up). */
  eyeY: number;
  /** Blink amount (0 = open, 1 = closed). */
  blinkAmount: number;
}

// ---------------------------------------------------------------------------
// Config — per-state tuning knobs
// ---------------------------------------------------------------------------

interface StateConfig {
  idle: {
    lookDuration: number;
    lookChangeChance: number;
    headRangeX: number;
    headRangeY: number;
    headRangeZ: number;
    eyeRange: number;
    lookAtUserChance: number;
    lookAtUserDurationMin: number;
    lookAtUserDurationMax: number;
  };
  listening: {
    nodIntensity: number;
    nodCount: number;
    nodCycleDuration: number;
    nodActivePortion: number;
    sideLookChance: number;
    sideLookDurationMin: number;
    sideLookDurationMax: number;
    sideLookHeadTurn: number;
    sideLookEyeRange: number;
    eyeMicroRange: number;
  };
  thinking: {
    lookDuration: number;
    lookChangeChance: number;
    headRangeX: number;
    headRangeY: number;
    headRangeZ: number;
    eyeRange: number;
    lookUpBias: number;
    eyeLeadTime: number;
    eyeLeadAmount: number;
    eyeHeadSync: number;
    lookAtUserChance: number;
    lookAtUserDurationMin: number;
    lookAtUserDurationMax: number;
  };
  talking: {
    nodIntensity: number;
    nodFrequency: number;
    nodVariation: number;
    nodIntensityVariation: number;
    nodFrequencyVariation: number;
    nodChangeInterval: number;
    tiltChance: number;
    tiltIntensity: number;
    occasionalTurn: number;
    eyeRange: number;
  };
}

const DEFAULT_STATE_CONFIG: StateConfig = {
  idle: {
    lookDuration: 3.0,
    lookChangeChance: 0.3,
    headRangeX: 0.20,
    headRangeY: 0.12,
    headRangeZ: 0.15,
    eyeRange: 0.5,
    lookAtUserChance: 0.35,
    lookAtUserDurationMin: 1.5,
    lookAtUserDurationMax: 3.5,
  },
  listening: {
    nodIntensity: 0.30,
    nodCount: 2,
    nodCycleDuration: 2.5,
    nodActivePortion: 0.4,
    sideLookChance: 0.15,
    sideLookDurationMin: 1.0,
    sideLookDurationMax: 3.0,
    sideLookHeadTurn: 0.10,
    sideLookEyeRange: 0.3,
    eyeMicroRange: 0.08,
  },
  thinking: {
    lookDuration: 1.5,
    lookChangeChance: 0.35,
    headRangeX: 0.10,
    headRangeY: 0.20,
    headRangeZ: 0.10,
    eyeRange: 0.5,
    lookUpBias: 0.6,
    eyeLeadTime: 0.10,
    eyeLeadAmount: 1.1,
    eyeHeadSync: 0.8,
    lookAtUserChance: 0.3,
    lookAtUserDurationMin: 1.0,
    lookAtUserDurationMax: 2.0,
  },
  talking: {
    nodIntensity: 0.35,
    nodFrequency: 1.8,
    nodVariation: 0.6,
    nodIntensityVariation: 0.4,
    nodFrequencyVariation: 0.5,
    nodChangeInterval: 1.5,
    tiltChance: 0.25,
    tiltIntensity: 0.06,
    occasionalTurn: 0.2,
    eyeRange: 0.4,
  },
};

// Per-state physics acceleration multipliers
const STATE_ACCELERATION: Record<AvatarState, number> = {
  idle: 1.0,
  listening: 8.0,
  thinking: 2.0,
  talking: 10.0,
};

// ---------------------------------------------------------------------------
// State Machine Class
// ---------------------------------------------------------------------------

export class AvatarStateMachine {
  // Current state
  private state: AvatarState = "idle";
  private stateTimer = 0;
  private config: StateConfig;

  // Transition handling
  private isTransitioning = false;
  private transitionTimer = 0;
  private transitionDuration = 0.5;
  private movementLocked = false;
  private movementLockTimer = 0;
  private movementLockDuration = 0.5;

  // Head — current, target, velocity (physics-based)
  private headCur = { x: 0, y: 0, z: 0 };
  private headTgt = { x: 0, y: 0, z: 0 };
  private headVel = { x: 0, y: 0, z: 0 };

  // Eyes — target position, current (lerped)
  private eyeTgt = { x: 0, y: 0 };
  private eyeCur = { x: 0, y: 0 };

  // Body sway
  private bodyTimer = 0;
  private bodyTgt = 0;
  private bodyCur = 0;

  // Blinking
  private blinkTimer = 0;
  private nextBlinkTime = 2 + Math.random() * 3;
  private blinkAmount = 0;
  private isBlinking = false;
  private blinkProgress = 0;
  private pendingDoubleBlink = false;
  private doubleBlinkDelay = 0;

  // Timers per state
  private headTimer = 0;
  private eyeTimer = 0;
  private eyeLeadTimer = 0;

  // Idle state tracking
  private idleLookingAtUser = false;
  private idleLookAtUserTimer = 0;

  // Listening state tracking
  private listeningSideLook = false;
  private listeningSideLookTimer = 0;
  private listeningSideDirection = 1;

  // Thinking state tracking
  private thinkingLookingAtUser = false;
  private thinkingLookAtUserTimer = 0;
  private pendingHeadTarget: { x: number; y: number; z: number } | null = null;

  // Talking state tracking
  private talkingNodPhase = 0;
  private talkingCurrentNodFreq = 2.0;
  private talkingCurrentNodIntensity = 0.2;
  private talkingNextNodChange = 0;

  // Physics constants
  private baseAcceleration = 0.001;
  private damping = 0.85;
  private transitionEaseSpeed = 0.08;

  constructor(config?: Partial<StateConfig>) {
    this.config = {
      idle: { ...DEFAULT_STATE_CONFIG.idle, ...config?.idle },
      listening: { ...DEFAULT_STATE_CONFIG.listening, ...config?.listening },
      thinking: { ...DEFAULT_STATE_CONFIG.thinking, ...config?.thinking },
      talking: { ...DEFAULT_STATE_CONFIG.talking, ...config?.talking },
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  setState(newState: AvatarState): void {
    if (this.state === newState) return;

    this.state = newState;
    this.stateTimer = 0;

    // Smooth transition — head eases to center first
    this.isTransitioning = true;
    this.transitionTimer = 0;
    this.headTgt = { x: 0, y: 0, z: 0 };
    this.eyeTgt = { x: 0, y: 0 };

    // Reset per-state timers
    this.headTimer = 0;
    this.eyeTimer = 0;
    this.eyeLeadTimer = 0;

    // Reset per-state tracking
    this.idleLookingAtUser = false;
    this.idleLookAtUserTimer = 0;
    this.listeningSideLook = false;
    this.listeningSideLookTimer = 0;
    this.talkingNextNodChange = 0;
    this.thinkingLookingAtUser = false;
    this.thinkingLookAtUserTimer = 0;
    this.pendingHeadTarget = null;
    this.movementLocked = false;
    this.movementLockTimer = 0;
  }

  getState(): AvatarState {
    return this.state;
  }

  /**
   * Call every frame. Returns the current output values.
   */
  update(deltaTime: number): StateMachineOutput {
    // Clamp deltaTime to avoid physics explosions on tab-switch
    const dt = Math.min(deltaTime, 0.1);

    // Always update blinking
    this.updateBlink(dt);

    // Transition handling
    if (this.isTransitioning) {
      this.transitionTimer += dt;
      const centered = this.centerHead(dt);
      if (centered && this.transitionTimer >= 0.3) {
        this.isTransitioning = false;
        this.movementLocked = true;
        this.movementLockTimer = 0;
        this.headVel = { x: 0, y: 0, z: 0 };
      }
    } else if (this.movementLocked) {
      this.movementLockTimer += dt;
      this.headTgt = { x: 0, y: 0, z: 0 };
      this.updateHeadPhysics(dt);
      this.eyeTgt = { x: 0, y: 0 };
      this.lerpEyes(dt, 0.05);
      if (this.movementLockTimer >= this.movementLockDuration) {
        this.movementLocked = false;
      }
    } else {
      // State-specific animations
      switch (this.state) {
        case "idle":
          this.updateIdle(dt);
          break;
        case "listening":
          this.updateListening(dt);
          break;
        case "thinking":
          this.updateThinking(dt);
          break;
        case "talking":
          this.updateTalking(dt);
          break;
      }
    }

    this.stateTimer += dt;

    // Body sway (gentle, always runs)
    this.bodyTimer += dt;
    if (this.bodyTimer > 2.8) {
      this.bodyTgt = this.rand(-0.04, 0.04);
      this.bodyTimer = 0;
    }
    this.bodyCur += (this.bodyTgt - this.bodyCur) * 0.01;

    return {
      headX: this.headCur.x,
      headY: this.headCur.y,
      headZ: this.headCur.z,
      bodyX: this.bodyCur,
      eyeX: this.eyeCur.x,
      eyeY: this.eyeCur.y,
      blinkAmount: this.blinkAmount,
    };
  }

  // ---------------------------------------------------------------------------
  // Physics helpers
  // ---------------------------------------------------------------------------

  private smoothEase(
    current: number,
    target: number,
    velocity: number,
    acceleration: number,
    damping: number,
    dt: number,
  ): { value: number; velocity: number } {
    const diff = target - current;
    const force = diff * acceleration;
    const newVel = (velocity + force) * damping;
    const newVal = current + newVel * dt * 60;
    return { value: newVal, velocity: newVel };
  }

  private updateHeadPhysics(dt: number): void {
    const mult = STATE_ACCELERATION[this.state] || 1;
    const acc = this.baseAcceleration * mult;

    const xr = this.smoothEase(this.headCur.x, this.headTgt.x, this.headVel.x, acc, this.damping, dt);
    const yr = this.smoothEase(this.headCur.y, this.headTgt.y, this.headVel.y, acc, this.damping, dt);
    const zr = this.smoothEase(this.headCur.z, this.headTgt.z, this.headVel.z, acc, this.damping, dt);

    this.headCur = { x: xr.value, y: yr.value, z: zr.value };
    this.headVel = { x: xr.velocity, y: yr.velocity, z: zr.velocity };
  }

  private centerHead(dt: number): boolean {
    const speed = this.transitionEaseSpeed;
    this.headCur.x += (0 - this.headCur.x) * speed;
    this.headCur.y += (0 - this.headCur.y) * speed;
    this.headCur.z += (0 - this.headCur.z) * speed;
    this.headVel.x *= 0.9;
    this.headVel.y *= 0.9;
    this.headVel.z *= 0.9;

    this.eyeTgt = { x: 0, y: 0 };
    this.lerpEyes(dt, speed * 1.5);

    const threshold = 0.015;
    return (
      Math.abs(this.headCur.x) < threshold &&
      Math.abs(this.headCur.y) < threshold &&
      Math.abs(this.headCur.z) < threshold
    );
  }

  private lerpEyes(dt: number, speed: number): void {
    this.eyeCur.x += (this.eyeTgt.x - this.eyeCur.x) * speed;
    this.eyeCur.y += (this.eyeTgt.y - this.eyeCur.y) * speed;
  }

  private rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  // ---------------------------------------------------------------------------
  // Blinking
  // ---------------------------------------------------------------------------

  private updateBlink(dt: number): void {
    this.blinkTimer += dt;

    if (this.isBlinking) {
      this.blinkProgress += dt;
      const bt = this.blinkProgress / 0.12;
      if (bt >= 1) {
        this.isBlinking = false;
        this.blinkProgress = 0;
        this.blinkAmount = 0;
        // 25% chance of double-blink
        if (!this.pendingDoubleBlink && Math.random() < 0.25) {
          this.pendingDoubleBlink = true;
          this.doubleBlinkDelay = 0.08 + Math.random() * 0.06;
        }
      } else {
        // Asymmetric blink curve — fast close, slower open
        this.blinkAmount = bt < 0.4
          ? 1 - (bt / 0.4) * (bt / 0.4)
          : ((bt - 1) / 0.6) * ((bt - 1) / 0.6);
        this.blinkAmount = 1 - this.blinkAmount; // invert so 1 = closed
      }
    } else if (this.pendingDoubleBlink) {
      this.doubleBlinkDelay -= dt;
      if (this.doubleBlinkDelay <= 0) {
        this.pendingDoubleBlink = false;
        this.isBlinking = true;
        this.blinkProgress = 0;
      }
    } else if (this.blinkTimer >= this.nextBlinkTime) {
      this.blinkTimer = 0;
      this.nextBlinkTime = 2.5 + Math.random() * 4;
      this.isBlinking = true;
      this.blinkProgress = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // IDLE — look around naturally, periodically look at user
  // ---------------------------------------------------------------------------

  private updateIdle(dt: number): void {
    const cfg = this.config.idle;
    this.headTimer += dt;
    this.eyeTimer += dt;

    if (this.idleLookingAtUser) {
      this.idleLookAtUserTimer -= dt;
      if (this.idleLookAtUserTimer <= 0) {
        this.idleLookingAtUser = false;
        this.headTimer = 0;
      }
    } else {
      if (this.headTimer > cfg.lookDuration) {
        if (Math.random() < cfg.lookAtUserChance) {
          // Look at user
          this.idleLookingAtUser = true;
          this.idleLookAtUserTimer = this.rand(cfg.lookAtUserDurationMin, cfg.lookAtUserDurationMax);
          this.headTgt = { x: 0, y: 0, z: 0 };
          this.eyeTgt = { x: 0, y: 0 };
          this.headTimer = 0;
        } else if (Math.random() < cfg.lookChangeChance) {
          // Random look direction
          const angle = Math.random() * Math.PI * 2;
          const rangeMult = 0.6 + Math.random() * 0.4;
          this.headTgt = {
            x: Math.sin(angle) * cfg.headRangeX * rangeMult,
            y: Math.cos(angle) * cfg.headRangeY * rangeMult,
            z: this.rand(-cfg.headRangeZ, cfg.headRangeZ) * rangeMult,
          };
          this.eyeTgt = {
            x: Math.sin(angle) * cfg.eyeRange,
            y: Math.cos(angle) * cfg.eyeRange * 0.4,
          };
          this.headTimer = 0;
        }
      }
    }

    this.updateHeadPhysics(dt);
    this.lerpEyes(dt, 0.025);
  }

  // ---------------------------------------------------------------------------
  // LISTENING — focus on user, deterministic nods, occasional side glances
  // ---------------------------------------------------------------------------

  private updateListening(dt: number): void {
    const cfg = this.config.listening;
    this.headTimer += dt;
    this.eyeTimer += dt;

    // Side glance behavior
    if (this.listeningSideLook) {
      this.listeningSideLookTimer -= dt;
      if (this.listeningSideLookTimer <= 0) {
        this.listeningSideLook = false;
        this.headTgt.y = 0;
        this.eyeTgt = { x: 0, y: 0 };
      }
    } else {
      if (Math.random() < cfg.sideLookChance * dt) {
        this.listeningSideLook = true;
        this.listeningSideLookTimer = this.rand(cfg.sideLookDurationMin, cfg.sideLookDurationMax);
        this.listeningSideDirection = Math.random() < 0.5 ? -1 : 1;
        this.headTgt.y = cfg.sideLookHeadTurn * this.listeningSideDirection;
        this.eyeTgt.x = cfg.sideLookEyeRange * this.listeningSideDirection;
        this.eyeTgt.y = 0;
      }
    }

    // Deterministic nod cycle
    const cycleTime = this.stateTimer % cfg.nodCycleDuration;
    const cyclePhase = cycleTime / cfg.nodCycleDuration;

    if (!this.listeningSideLook) {
      if (cyclePhase < cfg.nodActivePortion) {
        const nodProgress = cyclePhase / cfg.nodActivePortion;
        const nodPhase = nodProgress * Math.PI * 2 * cfg.nodCount;
        this.headTgt.x = Math.sin(nodPhase) * cfg.nodIntensity;
      } else {
        this.headTgt.x *= 0.9;
      }

      // Micro eye movements while focused
      if (this.eyeTimer > 2.0) {
        this.eyeTgt = {
          x: this.rand(-cfg.eyeMicroRange, cfg.eyeMicroRange),
          y: this.rand(-cfg.eyeMicroRange * 0.5, cfg.eyeMicroRange * 0.5),
        };
        this.eyeTimer = 0;
      }
    }

    this.updateHeadPhysics(dt);
    this.lerpEyes(dt, 0.03);
  }

  // ---------------------------------------------------------------------------
  // THINKING — eyes lead head, look away contemplatively
  // ---------------------------------------------------------------------------

  private updateThinking(dt: number): void {
    const cfg = this.config.thinking;
    this.headTimer += dt;
    this.eyeTimer += dt;
    this.eyeLeadTimer += dt;

    if (this.thinkingLookingAtUser) {
      this.thinkingLookAtUserTimer -= dt;
      if (this.thinkingLookAtUserTimer <= 0) {
        this.thinkingLookingAtUser = false;
        this.headTimer = 0;
      }
    } else {
      if (this.headTimer > cfg.lookDuration) {
        if (Math.random() < cfg.lookAtUserChance) {
          // Brief look at user
          this.thinkingLookingAtUser = true;
          this.thinkingLookAtUserTimer = this.rand(cfg.lookAtUserDurationMin, cfg.lookAtUserDurationMax);
          this.eyeTgt = { x: 0, y: 0 };
          this.pendingHeadTarget = { x: 0, y: 0, z: 0 };
          this.eyeLeadTimer = 0;
          this.headTimer = 0;
        } else if (Math.random() < cfg.lookChangeChance) {
          // Look away thoughtfully — bias upward
          const angle = Math.random() * Math.PI * 1.6 - Math.PI * 0.3;
          const upBias = cfg.lookUpBias * 0.20;
          const newHead = {
            x: Math.sin(angle) * cfg.headRangeX + upBias,
            y: Math.cos(angle) * cfg.headRangeY,
            z: this.rand(-cfg.headRangeZ, cfg.headRangeZ),
          };

          // Eyes move FIRST
          const eyeSync = Math.random() < cfg.eyeHeadSync;
          if (eyeSync) {
            this.eyeTgt = {
              x: Math.sin(angle) * cfg.eyeRange * cfg.eyeLeadAmount,
              y: (cfg.eyeRange * 0.5 + upBias * 2) * cfg.eyeLeadAmount,
            };
          } else {
            const divergeAngle = Math.random() * Math.PI * 2;
            this.eyeTgt = {
              x: Math.sin(divergeAngle) * cfg.eyeRange * 0.6,
              y: cfg.eyeRange * 0.3,
            };
          }

          this.pendingHeadTarget = newHead;
          this.eyeLeadTimer = 0;
          this.headTimer = 0;
        }
      }
    }

    // Apply pending head target after eye lead time
    if (this.pendingHeadTarget && this.eyeLeadTimer >= cfg.eyeLeadTime) {
      this.headTgt = { ...this.pendingHeadTarget };
      this.pendingHeadTarget = null;
    }

    this.updateHeadPhysics(dt);
    // Eyes move faster than head (they lead)
    this.lerpEyes(dt, 0.04);
  }

  // ---------------------------------------------------------------------------
  // TALKING — variable nodding, head tilts, eye on user
  // ---------------------------------------------------------------------------

  private updateTalking(dt: number): void {
    const cfg = this.config.talking;
    this.headTimer += dt;
    this.eyeTimer += dt;
    this.talkingNodPhase += dt;

    // Periodically change nod parameters
    if (this.stateTimer > this.talkingNextNodChange) {
      const freqVariation = 1 + (Math.random() * 2 - 1) * cfg.nodFrequencyVariation;
      this.talkingCurrentNodFreq = cfg.nodFrequency * freqVariation;
      const intensityVariation = 1 + (Math.random() * 2 - 1) * cfg.nodIntensityVariation;
      this.talkingCurrentNodIntensity = cfg.nodIntensity * intensityVariation;
      this.talkingNextNodChange = this.stateTimer + cfg.nodChangeInterval * (0.7 + Math.random() * 0.6);
    }

    // Nod with micro-pauses
    const nodActive = Math.random() > 0.15;
    if (nodActive) {
      const phase = (this.talkingNodPhase * this.talkingCurrentNodFreq * Math.PI * 2) % (Math.PI * 2);
      const rawNod = Math.sin(phase);
      const nodVariation = rawNod * (0.7 + Math.random() * 0.3);
      this.headTgt.x = nodVariation * this.talkingCurrentNodIntensity * cfg.nodVariation;
    } else {
      this.headTgt.x *= 0.9;
    }

    // Head tilts for emphasis
    if (Math.random() < cfg.tiltChance * dt) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.headTgt.z = cfg.tiltIntensity * dir * (0.6 + Math.random() * 0.4);
    }

    // Occasional head turns
    if (Math.random() < cfg.occasionalTurn * dt * 0.5) {
      this.headTgt.y = this.rand(-0.03, 0.03);
    }

    // Gradual decay of turns and tilts
    this.headTgt.y *= 0.95;
    this.headTgt.z *= 0.94;

    // Eye gaze — mostly on user with subtle shifts
    if (this.eyeTimer > 2.5) {
      this.eyeTgt = {
        x: this.rand(-cfg.eyeRange * 0.3, cfg.eyeRange * 0.3),
        y: this.rand(-0.08, 0.08),
      };
      this.eyeTimer = 0;
    }

    this.updateHeadPhysics(dt);
    this.lerpEyes(dt, 0.025);
  }
}
