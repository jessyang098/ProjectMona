"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { EmotionData, LipSyncCue } from "@/types/chat";
import { onExpressionCommand } from "@/lib/poseCommands";

// Types from pixi-live2d-display
interface Live2DModel {
  x: number;
  y: number;
  scale: { set: (x: number, y?: number) => void };
  anchor: { set: (x: number, y?: number) => void };
  internalModel: {
    coreModel: {
      setParameterValueById: (id: string, value: number) => void;
      getParameterValueById: (id: string) => number;
      getParameterIndex: (id: string) => number;
    };
    motionManager: {
      startMotion: (group: string, index: number, priority?: number) => Promise<boolean>;
      stopAllMotions: () => void;
    };
  };
  motion: (group: string, index?: number, priority?: number) => Promise<boolean>;
  expression: (name: string) => Promise<boolean>;
  update: (deltaTime: number) => void;
  destroy: () => void;
}

interface Live2DAvatarProps {
  modelUrl: string;
  emotion: EmotionData | null;
  audioUrl?: string | null;
  lipSync?: LipSyncCue[];
  onAudioEnd?: () => void;
}

// Emotion to expression mapping for Live2D models
// Vena has: blush, squeezed_eyes, closed_eyes, empty_eyes, cry
// Vena-specific names go first, then generic fallbacks for other models
const EMOTION_TO_EXPRESSION: Record<string, string[]> = {
  // Positive emotions
  happy: ["squeezed_eyes", "happy", "smile", "joy"],
  excited: ["squeezed_eyes", "happy", "excited", "joy"],
  content: ["closed_eyes", "relaxed", "happy"],
  affectionate: ["blush", "squeezed_eyes", "love", "happy"],
  playful: ["squeezed_eyes", "happy", "playful"],

  // Neutral/Mixed — empty array = clearExpressions (neutral face)
  curious: [],
  surprised: ["squeezed_eyes", "surprised", "shock"],
  embarrassed: ["blush", "embarrassed", "red"],
  confused: [],
  bored: ["empty_eyes", "bored", "relaxed"],
  neutral: [],

  // Negative emotions
  concerned: ["closed_eyes", "sad", "concerned", "worried"],
  sad: ["cry", "sad", "tearful"],
  annoyed: ["squeezed_eyes", "angry", "annoyed"],
  angry: ["squeezed_eyes", "angry", "anger", "mad"],
  frustrated: ["squeezed_eyes", "angry", "frustrated"],
};

// Expression parameters to reset when clearing to neutral
const EXPRESSION_PARAMS = [
  "Param3exp",      // blush
  "Param3exp4",     // squeezed eyes
  "Param3exp5",     // closed eyes
  "Param3exp6",     // empty eyes
  "Param3exp2cry",  // cry
  "ParamOnOff16",   // chibi
];

// Standard Live2D parameter names for lip sync
const LIP_SYNC_PARAMS = {
  mouthOpen: ["ParamMouthOpenY", "PARAM_MOUTH_OPEN_Y", "MouthOpenY"],
  mouthForm: ["ParamMouthForm", "PARAM_MOUTH_FORM", "MouthForm"],
};

// Standard parameters for idle animations
const IDLE_PARAMS = {
  breath: ["ParamBreath", "PARAM_BREATH", "Breath"],
  eyeLeft: ["ParamEyeLOpen", "PARAM_EYE_L_OPEN", "EyeLOpen"],
  eyeRight: ["ParamEyeROpen", "PARAM_EYE_R_OPEN", "EyeROpen"],
  eyeSmileL: ["ParamEyeLSmile"],
  eyeSmileR: ["ParamEyeRSmile"],
  eyeBallX: ["ParamEyeBallX"],
  eyeBallY: ["ParamEyeBallY"],
  browLY: ["ParamBrowLY"],
  browRY: ["ParamBrowRY"],
  browLAngle: ["ParamBrowLAngle"],
  browRAngle: ["ParamBrowRAngle"],
  mouthForm: ["ParamMouthForm", "PARAM_MOUTH_FORM"],
  angleX: ["ParamAngleX", "PARAM_ANGLE_X", "AngleX"],
  angleY: ["ParamAngleY", "PARAM_ANGLE_Y", "AngleY"],
  angleZ: ["ParamAngleZ", "PARAM_ANGLE_Z", "AngleZ"],
  bodyAngleX: ["ParamBodyAngleX", "PARAM_BODY_ANGLE_X", "BodyAngleX"],
  bodyAngleY: ["ParamBodyAngleY"],
  bodyAngleZ: ["ParamBodyAngleZ"],
  tail: ["Param7"], // 尾を上げて幸せ (raise tail happily)
  // Wings
  wingFlap: ["headwings"],
  wingToggle: ["headwings2"],
  // Dance params
  armL1: ["ParamArmL1"], armL2: ["ParamArmL2"],
  armR1: ["ParamArmR1"], armR2: ["ParamArmR2"],
  legL: ["ParamLegL"], legR: ["ParamLegR"],
  skirtFlap: ["ParamSkirtFlap"], skirtSway: ["ParamSkirtSway"],
};

// Dance event
const DANCE_EVENT = "mona:dance";

export default function Live2DAvatar({
  modelUrl,
  emotion,
  audioUrl,
  lipSync,
  onAudioEnd,
}: Live2DAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const dimensionsRef = useRef({ width: 800, height: 600 });

  // Get actual container dimensions - only for initial size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Only update state if dimensions actually changed significantly
        setDimensions(prev => {
          if (Math.abs(prev.width - rect.width) > 1 || Math.abs(prev.height - rect.height) > 1) {
            const newDims = { width: rect.width, height: rect.height };
            dimensionsRef.current = newDims;
            return newDims;
          }
          return prev;
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const { width, height } = dimensions;

  // Handle resize without destroying the entire app
  useEffect(() => {
    if (!appRef.current || !modelRef.current) return;

    const app = appRef.current;
    const model = modelRef.current;

    // Resize the renderer
    app.renderer.resize(width, height);

    // Reposition and rescale the model
    const modelAny = model as any;
    const modelOriginalHeight = modelAny.height || 1200;
    const scale = (height * 1.0) / modelOriginalHeight;
    model.scale.set(scale);
    model.x = width / 2;
    model.y = height / 2;
  }, [width, height]);

  const appRef = useRef<any>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const watermarkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const lipSyncRef = useRef<LipSyncCue[] | undefined>(lipSync);
  const isDancingRef = useRef(false);
  const danceTimerRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const timeDomainBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const frequencyBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const prevPhonemeRef = useRef({ aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 });

  // Keep lipSync ref updated
  useEffect(() => {
    lipSyncRef.current = lipSync;
  }, [lipSync]);

  // Animation state
  const animStateRef = useRef({
    breathTimer: 0,
    blinkTimer: 0,
    nextBlinkTime: 2,
    headTimer: 0,
    lastTime: 0,
    isPlaying: false,
    isBlinking: false,
    blinkProgress: 0,
    // Double-blink tracking
    pendingDoubleBlink: false,
    doubleBlinkDelay: 0,
    // Head "settle and drift" system
    headCurrentX: 0,
    headCurrentY: 0,
    headCurrentZ: 0,
    headTargetX: 0,
    headTargetY: 0,
    headTargetZ: 0,
    headSettleTimer: 0,
    nextHeadMoveTime: 2 + Math.random() * 3,
    // Eye gaze
    gazeCurrentX: 0,
    gazeCurrentY: 0,
    // Eyebrow micro-expressions
    browTimer: 0,
    // Tail wag
    tailTimer: 0,
    tailWagging: false,
    tailWagProgress: 0,
    nextTailWagTime: 5 + Math.random() * 8,
    // Fidget system — occasional larger movements
    fidgetTimer: 0,
    nextFidgetTime: 8 + Math.random() * 12,
    fidgetType: 0, // 0=none, 1=look around, 2=weight shift, 3=head tilt
    fidgetProgress: 0,
    fidgetDuration: 0,
    fidgetData: { x: 0, y: 0 },
    // Resting smile
    smileTimer: 0,
    // Wing flap
    wingTimer: 0,
  });

  // Find a working parameter name from alternatives
  const findParam = useCallback((model: Live2DModel, alternatives: string[]): string | null => {
    for (const name of alternatives) {
      try {
        const index = model.internalModel.coreModel.getParameterIndex(name);
        if (index >= 0) {
          return name;
        }
      } catch {
        // Parameter doesn't exist, try next
      }
    }
    return null;
  }, []);

  // Set a parameter value safely
  const setParam = useCallback((model: Live2DModel, alternatives: string[], value: number) => {
    const paramName = findParam(model, alternatives);
    if (paramName) {
      try {
        model.internalModel.coreModel.setParameterValueById(paramName, value);
      } catch {
        // Silently fail - parameter might not exist in this model
      }
    }
  }, [findParam]);

  // Map phoneme values to Live2D mouth parameters
  const applyLipSync = useCallback((model: Live2DModel, phonemes: LipSyncCue["phonemes"]) => {
    // Phoneme contributions to mouth opening:
    // aa (ah) = fully open mouth
    // oh/ou = rounded open mouth
    // ee/ih = slightly open, wide mouth

    // Weight phonemes by how much they open the mouth
    const openWeight =
      phonemes.aa * 1.0 +     // "ah" - most open
      phonemes.oh * 0.8 +     // "oh" - rounded open
      phonemes.ou * 0.7 +     // "oo" - rounded, less open
      phonemes.ee * 0.4 +     // "ee" - wide but not very open
      phonemes.ih * 0.3;      // "ih" - minimal opening

    // Clamp to 0-1 range with slight amplification for visibility
    const mouthOpen = Math.min(1, Math.max(0, openWeight));

    // Calculate mouth form (shape): positive = wide, negative = round/puckered
    // ee/ih make the mouth wide (smile-like)
    // oh/ou make the mouth round (pucker-like)
    const wideContribution = phonemes.ee * 0.6 + phonemes.ih * 0.4;
    const roundContribution = phonemes.oh * 0.5 + phonemes.ou * 0.7;
    const mouthForm = wideContribution - roundContribution;

    setParam(model, LIP_SYNC_PARAMS.mouthOpen, mouthOpen);
    setParam(model, LIP_SYNC_PARAMS.mouthForm, mouthForm);
  }, [setParam]);

  // Hide watermark part by index
  const hideWatermark = useCallback((model: Live2DModel) => {
    try {
      // Set parameter to 0 (controls visibility toggle)
      model.internalModel.coreModel.setParameterValueById("Param129", 0);

      // Get the part index for Part84 (watermark) and set opacity to 0
      const coreModel = model.internalModel.coreModel as any;

      // Try different methods to get part index and set opacity
      if (typeof coreModel.getPartIndex === 'function') {
        const partIndex = coreModel.getPartIndex("Part84");
        if (partIndex >= 0) {
          if (typeof coreModel.setPartOpacityByIndex === 'function') {
            coreModel.setPartOpacityByIndex(partIndex, 0);
          } else if (coreModel._partOpacities && Array.isArray(coreModel._partOpacities)) {
            coreModel._partOpacities[partIndex] = 0;
          }
        }
      }

      // Also try through the model's parts array if available
      if (coreModel._model && coreModel._model.parts) {
        const parts = coreModel._model.parts;
        for (let i = 0; i < parts.count; i++) {
          const partId = parts.ids[i];
          if (partId === "Part84") {
            if (typeof parts.opacities !== 'undefined') {
              parts.opacities[i] = 0;
            }
            break;
          }
        }
      }
    } catch {
      // Ignore errors - watermark hiding is best-effort
    }
  }, []);

  // Update idle animations — lifelike VTuber idle behavior
  // Key: Arms are physics OUTPUTS driven by body angles, so body sway = arm movement
  // Key: Head AngleX (turn) exposes 2D flatness — use tilt (Z) and nod (Y) instead
  const updateIdleAnimations = useCallback((model: Live2DModel, delta: number) => {
    const state = animStateRef.current;
    state.headTimer += delta;
    const t = state.headTimer;

    // ── Breathing (drives subtle arm sway via physics weight 10%) ──
    state.breathTimer += delta;
    const breathDepth = 0.25 + 0.15 * Math.sin(state.breathTimer * 0.3);
    const breathValue = (Math.sin(state.breathTimer * 1.8) + 1) * breathDepth;
    setParam(model, IDLE_PARAMS.breath, breathValue);

    // ── Blinking ──
    state.blinkTimer += delta;
    if (state.isBlinking) {
      state.blinkProgress += delta;
      const bt = state.blinkProgress / 0.12;
      if (bt >= 1) {
        state.isBlinking = false;
        state.blinkProgress = 0;
        setParam(model, IDLE_PARAMS.eyeLeft, 1);
        setParam(model, IDLE_PARAMS.eyeRight, 1);
        if (!state.pendingDoubleBlink && Math.random() < 0.25) {
          state.pendingDoubleBlink = true;
          state.doubleBlinkDelay = 0.08 + Math.random() * 0.06;
        }
      } else {
        const eyeOpen = bt < 0.4
          ? 1 - (bt / 0.4) * (bt / 0.4)
          : ((bt - 1) / 0.6) * ((bt - 1) / 0.6);
        setParam(model, IDLE_PARAMS.eyeLeft, Math.max(0, eyeOpen));
        setParam(model, IDLE_PARAMS.eyeRight, Math.max(0, eyeOpen));
      }
    } else if (state.pendingDoubleBlink) {
      state.doubleBlinkDelay -= delta;
      if (state.doubleBlinkDelay <= 0) {
        state.pendingDoubleBlink = false;
        state.isBlinking = true;
        state.blinkProgress = 0;
      }
    } else if (state.blinkTimer >= state.nextBlinkTime) {
      state.blinkTimer = 0;
      state.nextBlinkTime = 2.5 + Math.random() * 4;
      state.isBlinking = true;
      state.blinkProgress = 0;
    }

    // ── Head movement — primarily TILT (Z), minimal turn (X), subtle nod (Y) ──
    state.headSettleTimer += delta;
    if (state.headSettleTimer >= state.nextHeadMoveTime) {
      state.headSettleTimer = 0;
      state.nextHeadMoveTime = 3 + Math.random() * 4;
      // Almost no left/right turn — exposes 2D flatness
      state.headTargetX = (Math.random() - 0.5) * 0.15; // ±0.075 (nearly zero)
      // Gentle nods
      state.headTargetY = (Math.random() - 0.5) * 0.3;  // ±0.15
      // Tilt is the main head animation — looks cute, hides 2D
      state.headTargetZ = (Math.random() - 0.5) * 0.6;  // ±0.3
    }
    const headLerp = 1 - Math.pow(0.05, delta);
    state.headCurrentX += (state.headTargetX - state.headCurrentX) * headLerp;
    state.headCurrentY += (state.headTargetY - state.headCurrentY) * headLerp;
    state.headCurrentZ += (state.headTargetZ - state.headCurrentZ) * headLerp;
    let headX = state.headCurrentX;
    let headY = state.headCurrentY;
    let headZ = state.headCurrentZ;

    // ── Fidget system — body leans that drive arm physics + cute head tilts ──
    state.fidgetTimer += delta;
    if (state.fidgetType === 0 && state.fidgetTimer >= state.nextFidgetTime) {
      state.fidgetTimer = 0;
      state.nextFidgetTime = 6 + Math.random() * 10;
      state.fidgetProgress = 0;
      const roll = Math.random();
      if (roll < 0.35) {
        // Side lean — drives arm sway via physics
        state.fidgetType = 2;
        state.fidgetDuration = 2.5 + Math.random() * 2;
        state.fidgetData = { x: (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.8), y: 0 };
      } else if (roll < 0.65) {
        // Cute head tilt
        state.fidgetType = 3;
        state.fidgetDuration = 2.0 + Math.random() * 1.5;
        state.fidgetData = { x: 0, y: (Math.random() > 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.25) };
      } else {
        // Forward/back lean — drives skirt + subtle arm movement
        state.fidgetType = 4;
        state.fidgetDuration = 2.0 + Math.random() * 1.5;
        state.fidgetData = { x: (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.4), y: 0 };
      }
    }

    let fidgetBodyX = 0, fidgetBodyY = 0;
    if (state.fidgetType > 0) {
      state.fidgetProgress += delta;
      const fp = state.fidgetProgress / state.fidgetDuration;
      const fidgetStrength = Math.sin(Math.min(fp, 1) * Math.PI);

      if (state.fidgetType === 2) {
        fidgetBodyX = state.fidgetData.x * fidgetStrength; // side lean → arms
      } else if (state.fidgetType === 3) {
        headZ += state.fidgetData.y * fidgetStrength; // head tilt
      } else if (state.fidgetType === 4) {
        fidgetBodyY = state.fidgetData.x * fidgetStrength; // forward/back lean
      }

      if (fp >= 1) {
        state.fidgetType = 0;
        state.fidgetProgress = 0;
      }
    }

    setParam(model, IDLE_PARAMS.angleX, headX);
    setParam(model, IDLE_PARAMS.angleY, headY);
    setParam(model, IDLE_PARAMS.angleZ, headZ);

    // ── Body sway (drives arms, skirt, legs via physics) ──
    // bodyAngleX → arm sway (physics settings 1&2) + skirt sway (setting 20)
    // bodyAngleY → skirt flap (setting 21) + boob physics (setting 3)
    // bodyAngleZ → leg movement (settings 7&8)
    const bodySwayX = Math.sin(t * 0.25) * 0.6 + Math.sin(t * 0.6) * 0.3; // gentle side-to-side
    const bodySwayY = Math.sin(t * 0.15) * 0.2; // very slow forward/back
    const bodySwayZ = Math.sin(t * 0.2) * 0.15; // minimal rotation
    setParam(model, IDLE_PARAMS.bodyAngleX, bodySwayX + fidgetBodyX);
    setParam(model, IDLE_PARAMS.bodyAngleY, bodySwayY + fidgetBodyY);
    setParam(model, IDLE_PARAMS.bodyAngleZ, bodySwayZ);

    // ── Eye gaze — look at user ──
    setParam(model, IDLE_PARAMS.eyeBallX, 0);
    setParam(model, IDLE_PARAMS.eyeBallY, 0.15);

    // ── Eye smile (subtle resting squint) ──
    const eyeSmile = 0.1 + 0.06 * Math.sin(t * 0.25);
    setParam(model, IDLE_PARAMS.eyeSmileL, eyeSmile);
    setParam(model, IDLE_PARAMS.eyeSmileR, eyeSmile);

    // ── Resting smile ──
    state.smileTimer += delta;
    if (!animStateRef.current.isPlaying) {
      const smileValue = 0.15 + 0.1 * Math.sin(state.smileTimer * 0.2);
      setParam(model, IDLE_PARAMS.mouthForm, smileValue);
    }

    // ── Eyebrow micro-movements ──
    state.browTimer += delta;
    const browY = Math.sin(state.browTimer * 0.4) * 0.12 + Math.sin(state.browTimer * 1.1) * 0.04;
    const browAngle = Math.sin(state.browTimer * 0.3) * 0.08;
    setParam(model, IDLE_PARAMS.browLY, browY);
    setParam(model, IDLE_PARAMS.browRY, browY);
    setParam(model, IDLE_PARAMS.browLAngle, browAngle);
    setParam(model, IDLE_PARAMS.browRAngle, browAngle);

    // ── Tail wag (periodic) ──
    state.tailTimer += delta;
    if (!state.tailWagging && state.tailTimer >= state.nextTailWagTime) {
      state.tailWagging = true;
      state.tailWagProgress = 0;
      state.tailTimer = 0;
      state.nextTailWagTime = 8 + Math.random() * 15;
    }
    if (state.tailWagging) {
      state.tailWagProgress += delta;
      const wagDuration = 2.5;
      const wp = state.tailWagProgress / wagDuration;
      if (wp >= 1) {
        state.tailWagging = false;
        setParam(model, IDLE_PARAMS.tail, 0);
      } else {
        const envelope = Math.sin(wp * Math.PI);
        const wiggle = Math.sin(state.tailWagProgress * 12) * 0.15;
        setParam(model, IDLE_PARAMS.tail, (0.6 + wiggle) * envelope);
      }
    }

    // ── Wing flap (continuous gentle flutter) ──
    setParam(model, IDLE_PARAMS.wingToggle, 1); // ensure wings are visible
    state.wingTimer += delta;
    const wingBase = Math.sin(state.wingTimer * 1.2) * 0.3;
    const wingFlutter = Math.sin(state.wingTimer * 3.5) * 0.15;
    const wingMicro = Math.sin(state.wingTimer * 7.0) * 0.05;
    setParam(model, IDLE_PARAMS.wingFlap, wingBase + wingFlutter + wingMicro);
  }, [setParam]);

  // Dance animation — ~130 BPM cute bounce with arm/body choreography
  const updateDanceAnimation = useCallback((model: Live2DModel, delta: number) => {
    danceTimerRef.current += delta;
    const dt = danceTimerRef.current;
    const bpm = 130;
    const beat = (dt * bpm) / 60; // beat counter
    const beatPhase = (beat % 1) * Math.PI * 2; // 0-2π per beat
    const halfBeat = (beat * 2 % 1) * Math.PI * 2; // double-time

    // ── Body bounce (on every beat) ──
    const bounce = Math.abs(Math.sin(beatPhase)) * 3;
    setParam(model, IDLE_PARAMS.bodyAngleY, -bounce); // down on beat

    // ── Side-to-side sway (every 2 beats) ──
    const sway = Math.sin(beatPhase * 0.5) * 8;
    setParam(model, IDLE_PARAMS.bodyAngleX, sway);
    setParam(model, IDLE_PARAMS.bodyAngleZ, Math.sin(beatPhase * 0.5) * 2);

    // ── Head bob (follows body, slight delay feel) ──
    const headBob = Math.sin(beatPhase + 0.3) * 3;
    const headTilt = Math.sin(beatPhase * 0.5) * 5;
    setParam(model, IDLE_PARAMS.angleY, headBob);
    setParam(model, IDLE_PARAMS.angleX, headTilt * 0.5);
    setParam(model, IDLE_PARAMS.angleZ, -headTilt * 0.4);

    // ── Arms — alternate raise pattern (4-beat cycle) ──
    const armCycle = (beat % 4);
    let armL = 0, armR = 0;
    if (armCycle < 1) {
      // Beat 1: left arm up
      armL = Math.sin(beatPhase) * 0.6;
      armR = 0;
    } else if (armCycle < 2) {
      // Beat 2: right arm up
      armL = 0;
      armR = Math.sin(beatPhase) * 0.6;
    } else if (armCycle < 3) {
      // Beat 3: both arms up
      armL = Math.sin(beatPhase) * 0.5;
      armR = Math.sin(beatPhase) * 0.5;
    } else {
      // Beat 4: arms swing opposite
      armL = Math.sin(beatPhase) * 0.4;
      armR = -Math.sin(beatPhase) * 0.4;
    }
    setParam(model, IDLE_PARAMS.armL1, armL);
    setParam(model, IDLE_PARAMS.armR1, armR);
    // Secondary arm joints follow with slight offset
    setParam(model, IDLE_PARAMS.armL2, armL * 0.5);
    setParam(model, IDLE_PARAMS.armR2, armR * 0.5);

    // ── Legs — subtle alternating step ──
    setParam(model, IDLE_PARAMS.legL, Math.sin(beatPhase) * 0.3);
    setParam(model, IDLE_PARAMS.legR, -Math.sin(beatPhase) * 0.3);

    // ── Skirt follows body motion ──
    setParam(model, IDLE_PARAMS.skirtFlap, bounce * 0.3);
    setParam(model, IDLE_PARAMS.skirtSway, sway * 0.1);

    // ── Tail — continuous happy wag ──
    setParam(model, IDLE_PARAMS.tail, 0.5 + Math.sin(dt * 14) * 0.3);

    // ── Happy face — squeezed eyes + smile ──
    setParam(model, IDLE_PARAMS.eyeSmileL, 0.3);
    setParam(model, IDLE_PARAMS.eyeSmileR, 0.3);
    setParam(model, IDLE_PARAMS.mouthForm, 0.4 + Math.sin(halfBeat) * 0.1);

    // ── Breathing fast (exertion) ──
    setParam(model, IDLE_PARAMS.breath, (Math.sin(dt * 4) + 1) * 0.4);

    // ── Eyes look at user ──
    setParam(model, IDLE_PARAMS.eyeBallX, 0);
    setParam(model, IDLE_PARAMS.eyeBallY, 0.15);

    // ── Wings — fast energetic flapping synced to beat ──
    setParam(model, IDLE_PARAMS.wingToggle, 1); // ensure wings are visible
    setParam(model, IDLE_PARAMS.wingFlap, Math.sin(beatPhase * 2) * 0.6 + bounce * 0.1);

    // ── Blinking (still blink while dancing) ──
    const state = animStateRef.current;
    state.blinkTimer += delta;
    if (state.isBlinking) {
      state.blinkProgress += delta;
      const bt = state.blinkProgress / 0.12;
      if (bt >= 1) {
        state.isBlinking = false;
        state.blinkProgress = 0;
        setParam(model, IDLE_PARAMS.eyeLeft, 1);
        setParam(model, IDLE_PARAMS.eyeRight, 1);
      } else {
        const eyeOpen = bt < 0.4 ? 1 - (bt / 0.4) ** 2 : ((bt - 1) / 0.6) ** 2;
        setParam(model, IDLE_PARAMS.eyeLeft, Math.max(0, eyeOpen));
        setParam(model, IDLE_PARAMS.eyeRight, Math.max(0, eyeOpen));
      }
    } else if (state.blinkTimer >= state.nextBlinkTime) {
      state.blinkTimer = 0;
      state.nextBlinkTime = 2 + Math.random() * 3;
      state.isBlinking = true;
      state.blinkProgress = 0;
    }
  }, [setParam]);

  // Reset dance params to 0 when dance stops
  const resetDanceParams = useCallback((model: Live2DModel) => {
    setParam(model, IDLE_PARAMS.armL1, 0);
    setParam(model, IDLE_PARAMS.armL2, 0);
    setParam(model, IDLE_PARAMS.armR1, 0);
    setParam(model, IDLE_PARAMS.armR2, 0);
    setParam(model, IDLE_PARAMS.legL, 0);
    setParam(model, IDLE_PARAMS.legR, 0);
    setParam(model, IDLE_PARAMS.skirtFlap, 0);
    setParam(model, IDLE_PARAMS.skirtSway, 0);
  }, [setParam]);

  // Initialize PixiJS and Live2D
  useEffect(() => {
    if (!canvasRef.current) return;

    let mounted = true;

    // Load Cubism 4 SDK from CDN (required for moc3 files)
    const loadCubismSDK = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if ((window as any).Live2DCubismCore) {
          resolve();
          return;
        }

        const script = document.createElement("script");
        script.src = "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js";
        script.onload = () => {
          // Log removed("✅ Cubism 4 SDK loaded");
          resolve();
        };
        script.onerror = () => reject(new Error("Failed to load Cubism SDK"));
        document.head.appendChild(script);
      });
    };

    const initLive2D = async () => {
      try {
        // Load Cubism SDK first (required by pixi-live2d-display)
        await loadCubismSDK();

        // Dynamic imports for PixiJS and Live2D (cubism4 build for moc3 support)
        const PIXI = await import("pixi.js");
        const { Live2DModel: Live2DModelClass } = await import("pixi-live2d-display/cubism4");

        // Register Live2D with PixiJS ticker (v6 API)
        (Live2DModelClass as any).registerTicker(PIXI.Ticker);

        if (!mounted || !canvasRef.current) return;

        // Get current dimensions from ref (fresher than closure)
        const initWidth = dimensionsRef.current.width;
        const initHeight = dimensionsRef.current.height;

        // Create PixiJS application (v6 API - synchronous constructor)
        const app = new PIXI.Application({
          view: canvasRef.current,
          width: initWidth,
          height: initHeight,
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 1.5), // Cap at 1.5x to avoid Retina perf hit
          autoDensity: true,
        });

        if (!mounted) {
          app.destroy();
          return;
        }

        appRef.current = app;

        // Load the Live2D model
        // Log removed("🎭 Loading Live2D model from:", modelUrl);
        const model = await Live2DModelClass.from(modelUrl) as unknown as Live2DModel;

        if (!mounted) {
          model.destroy();
          app.destroy();
          return;
        }

        // Scale to fit canvas height (larger)
        const modelAny = model as any;
        const modelOriginalHeight = modelAny.height || 1200;
        const scale = (initHeight * 1.0) / modelOriginalHeight;
        model.scale.set(scale);

        // Position model - anchor at center
        model.anchor.set(0.5, 0.5);
        model.x = initWidth / 2;
        model.y = initHeight / 2;

        // Enable dragging for position adjustment
        modelAny.interactive = true;
        modelAny.buttonMode = true;

        let dragging = false;
        let dragOffset = { x: 0, y: 0 };

        modelAny.on('pointerdown', (event: any) => {
          dragging = true;
          const pos = event.data.global;
          dragOffset.x = pos.x - model.x;
          dragOffset.y = pos.y - model.y;
        });

        modelAny.on('pointermove', (event: any) => {
          if (dragging) {
            const pos = event.data.global;
            model.x = pos.x - dragOffset.x;
            model.y = pos.y - dragOffset.y;
          }
        });

        modelAny.on('pointerup', () => {
          if (dragging) {
            dragging = false;
          }
        });

        modelAny.on('pointerupoutside', () => {
          if (dragging) {
            dragging = false;
          }
        });

        app.stage.addChild(model as any);
        modelRef.current = model;

        // Hide watermark on initial load + periodic re-hide (Live2D resets it)
        hideWatermark(model);
        watermarkIntervalRef.current = setInterval(() => {
          if (modelRef.current) hideWatermark(modelRef.current);
        }, 500); // Every 500ms, not every frame

        // Verify lip sync parameters exist
        const mouthOpenParam = findParam(model, LIP_SYNC_PARAMS.mouthOpen);
        const mouthFormParam = findParam(model, LIP_SYNC_PARAMS.mouthForm);

        // Start animation loop
        animStateRef.current.lastTime = performance.now();
        const animate = () => {
          if (!mounted || !modelRef.current) return;

          const now = performance.now();
          const delta = (now - animStateRef.current.lastTime) / 1000;
          animStateRef.current.lastTime = now;

          // Update animations (dance overrides idle)
          if (isDancingRef.current) {
            updateDanceAnimation(modelRef.current, delta);
          } else {
            updateIdleAnimations(modelRef.current, delta);
          }

          // Update lip sync if audio is playing
          if (audioRef.current && !audioRef.current.paused) {
            const currentTime = audioRef.current.currentTime;
            const audioDuration = audioRef.current.duration;

            if (lipSyncRef.current && lipSyncRef.current.length > 0) {
              // Timed lip sync from backend
              if (currentTime < audioDuration - 0.1) {
                const cue = lipSyncRef.current.find(c => currentTime >= c.start && currentTime < c.end);
                if (cue) {
                  applyLipSync(modelRef.current, cue.phonemes);
                } else {
                  applyLipSync(modelRef.current, { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 });
                }
              } else {
                applyLipSync(modelRef.current, { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 });
              }
            } else if (analyserRef.current && timeDomainBufferRef.current && frequencyBufferRef.current) {
              // Real-time audio analysis fallback
              analyserRef.current.getByteTimeDomainData(timeDomainBufferRef.current);
              analyserRef.current.getByteFrequencyData(frequencyBufferRef.current);

              // RMS amplitude
              let sumSquares = 0;
              for (let i = 0; i < timeDomainBufferRef.current.length; i++) {
                const n = (timeDomainBufferRef.current[i] - 128) / 128;
                sumSquares += n * n;
              }
              const amplitude = Math.sqrt(sumSquares / timeDomainBufferRef.current.length);

              // Spectral centroid
              let weightedSum = 0, magSum = 0;
              for (let i = 0; i < frequencyBufferRef.current.length; i++) {
                const mag = frequencyBufferRef.current[i];
                weightedSum += i * mag;
                magSum += mag;
              }
              const centroid = magSum > 0 ? weightedSum / magSum / frequencyBufferRef.current.length : 0;

              // Map to phonemes
              const threshold = 0.0005;
              const phonemes = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
              if (amplitude > threshold) {
                const level = Math.min(0.8, (amplitude - threshold) * 12);
                phonemes.aa = level;
                if (centroid > 0.45) phonemes.ee = level * 0.7;
                else if (centroid > 0.35) phonemes.ih = level * 0.8;
                else if (centroid > 0.25) phonemes.oh = level * 0.9;
                else phonemes.ou = level;
              }

              // Smooth
              const smooth = 0.2;
              const prev = prevPhonemeRef.current;
              const smoothed = {
                aa: prev.aa + smooth * (phonemes.aa - prev.aa),
                ee: prev.ee + smooth * (phonemes.ee - prev.ee),
                ih: prev.ih + smooth * (phonemes.ih - prev.ih),
                oh: prev.oh + smooth * (phonemes.oh - prev.oh),
                ou: prev.ou + smooth * (phonemes.ou - prev.ou),
              };
              prevPhonemeRef.current = smoothed;
              applyLipSync(modelRef.current, smoothed);
            }
          }

          animationFrameRef.current = requestAnimationFrame(animate);
        };
        animate();

      } catch (error) {
        // Error removed("❌ Failed to load Live2D model:", error);
      }
    };

    initLive2D();

    return () => {
      mounted = false;
      if (watermarkIntervalRef.current) {
        clearInterval(watermarkIntervalRef.current);
        watermarkIntervalRef.current = null;
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (modelRef.current) {
        modelRef.current.destroy();
        modelRef.current = null;
      }

      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [modelUrl, updateIdleAnimations, updateDanceAnimation, applyLipSync, hideWatermark, findParam]);

  // Clear all expression parameters back to 0 (return to neutral face)
  const clearExpressions = useCallback((model: Live2DModel) => {
    for (const paramId of EXPRESSION_PARAMS) {
      try {
        model.internalModel.coreModel.setParameterValueById(paramId, 0);
      } catch {
        // Param doesn't exist on this model, skip
      }
    }
  }, []);

  // Handle emotion changes
  useEffect(() => {
    if (!modelRef.current || !emotion) return;

    // "neutral" means clear all expressions — return to normal face
    if (emotion.emotion === "neutral") {
      clearExpressions(modelRef.current);
      return;
    }

    const expressionCandidates = EMOTION_TO_EXPRESSION[emotion.emotion] || [];
    if (expressionCandidates.length === 0) {
      clearExpressions(modelRef.current);
      return;
    }

    // Try each candidate expression until one works
    const tryExpression = async (index: number) => {
      if (index >= expressionCandidates.length || !modelRef.current) return;

      try {
        const expressionName = expressionCandidates[index];
        const success = await modelRef.current.expression(expressionName);
        if (success) {
          // Expression applied
        } else {
          tryExpression(index + 1);
        }
      } catch {
        tryExpression(index + 1);
      }
    };

    tryExpression(0);
  }, [emotion, clearExpressions]);

  // Listen for test expression commands (test:expr:<name>)
  useEffect(() => {
    const cleanup = onExpressionCommand((cmd) => {
      if (!modelRef.current) return;

      if (cmd.type === "clear") {
        clearExpressions(modelRef.current);
        return;
      }

      if (cmd.expression) {
        modelRef.current.expression(cmd.expression).catch(() => {});
      }
    });

    return cleanup;
  }, []);

  // Listen for dance commands (test:dance)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "toggle") {
        isDancingRef.current = !isDancingRef.current;
        if (isDancingRef.current) {
          danceTimerRef.current = 0;
          // Set happy expression
          if (modelRef.current) {
            modelRef.current.expression("squeezed_eyes").catch(() => {});
          }
        } else {
          // Reset dance params and clear expression
          if (modelRef.current) {
            resetDanceParams(modelRef.current);
            clearExpressions(modelRef.current);
          }
        }
      } else if (detail === "start") {
        isDancingRef.current = true;
        danceTimerRef.current = 0;
        if (modelRef.current) {
          modelRef.current.expression("squeezed_eyes").catch(() => {});
        }
      } else if (detail === "stop") {
        isDancingRef.current = false;
        if (modelRef.current) {
          resetDanceParams(modelRef.current);
          clearExpressions(modelRef.current);
        }
      }
    };
    window.addEventListener(DANCE_EVENT, handler);
    return () => window.removeEventListener(DANCE_EVENT, handler);
  }, [resetDanceParams, clearExpressions]);

  // Handle audio playback
  useEffect(() => {
    if (!audioUrl || audioUrl === currentAudioUrlRef.current) return;

    currentAudioUrlRef.current = audioUrl;

    // Track if this effect is still active
    let isActive = true;

    // Stop any current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    // Create new audio element
    const audio = new Audio(audioUrl);
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audioRef.current = audio;

    // Set up Web Audio API analyser for real-time lip sync fallback
    const hasLipSyncData = lipSyncRef.current && lipSyncRef.current.length > 0;
    if (!hasLipSyncData) {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === "suspended") {
          ctx.resume();
        }
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;
        timeDomainBufferRef.current = new Uint8Array(analyser.fftSize);
        frequencyBufferRef.current = new Uint8Array(analyser.frequencyBinCount);

        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        sourceRef.current = source;
      } catch {
        // Web Audio API not available, lip sync will be skipped
      }
    }

    audio.onended = () => {
      animStateRef.current.isPlaying = false;
      prevPhonemeRef.current = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
      // Close mouth when audio ends
      if (modelRef.current) {
        applyLipSync(modelRef.current, { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 });
      }
      // Call callback for queued audio playback
      if (onAudioEnd) {
        onAudioEnd();
      }
    };

    audio.onerror = (e) => {
      // Ignore abort errors that happen during cleanup
      if (audio.error?.code !== MediaError.MEDIA_ERR_ABORTED) {
        // Error removed("❌ Live2D audio error:", e);
      }
    };

    // Wait for audio to be ready before playing
    audio.oncanplaythrough = () => {
      if (!isActive) return;

      // Start playback
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          if (isActive) {
            animStateRef.current.isPlaying = true;
            // Log removed("▶️ Live2D audio playing");
          }
        }).catch((error) => {
          // Ignore abort errors from cleanup
          if (error.name !== "AbortError") {
            // Error removed("❌ Live2D audio playback failed:", error);
          }
        });
      }
    };

    return () => {
      isActive = false;
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.oncanplaythrough = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current = null;
      }
    };
  }, [audioUrl, applyLipSync, onAudioEnd]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden", // Clip any content outside bounds (hides foot watermark)
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  );
}
