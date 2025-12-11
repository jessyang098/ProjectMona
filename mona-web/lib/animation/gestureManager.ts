/**
 * Gesture Animation Manager
 * Handles loading and triggering animations based on emotions
 * Supports both Mixamo FBX and VRMA (VRM-native) animation formats
 */

import * as THREE from "three";
import { VRM } from "@pixiv/three-vrm";
import { loadMixamoAnimation } from "./mixamoLoader";
import { loadVRMAAnimation, isVRMAFile } from "./vrmaLoader";

export type EmotionType = "happy" | "excited" | "curious" | "embarrassed" | "sad" | "concerned" | "neutral" | "annoyed" | "frustrated" | "surprised";
export type GestureName =
  | "wave"
  | "goodbye"
  | "thinking"
  | "excited_jump"
  | "clapping"
  | "blush"
  | "sad"
  | "looking_around"
  | "angry"
  | "relax"
  | "sleepy"
  | "surprised"
  | "crouch"
  | "lay"
  | "stand1";

interface GestureConfig {
  name: GestureName;
  path: string;
  triggerEmotions: EmotionType[];
  priority: number; // Higher = more likely to play
  duration?: number; // Optional override
  isHoldPose?: boolean; // If true, holds the pose until manually stopped
}

const GESTURE_CONFIGS: GestureConfig[] = [
  // === VRMA (VRM-native) Animations ===

  // Wave/Greeting - manual trigger only
  { name: "wave", path: "/animations/wave.fbx", triggerEmotions: [], priority: 10 },
  { name: "goodbye", path: "/animations/Goodbye.vrma", triggerEmotions: [], priority: 10 },

  // Happy/Excited gestures
  { name: "excited_jump", path: "/animations/Jump.vrma", triggerEmotions: ["excited"], priority: 9 },
  { name: "clapping", path: "/animations/Clapping.vrma", triggerEmotions: ["happy", "excited"], priority: 8 },

  // Curious gestures
  { name: "thinking", path: "/animations/Thinking.vrma", triggerEmotions: ["curious"], priority: 7 },
  { name: "looking_around", path: "/animations/LookAround.vrma", triggerEmotions: ["curious"], priority: 6 },

  // Embarrassed gestures
  { name: "blush", path: "/animations/Blush.vrma", triggerEmotions: ["embarrassed"], priority: 8 },

  // Sad/Concerned gestures
  { name: "sad", path: "/animations/Sad.vrma", triggerEmotions: ["sad", "concerned"], priority: 7 },

  // Angry/Frustrated gestures
  { name: "angry", path: "/animations/Angry.vrma", triggerEmotions: ["annoyed", "frustrated"], priority: 7 },

  // Surprise gesture
  { name: "surprised", path: "/animations/Surprised.vrma", triggerEmotions: ["surprised"], priority: 8 },

  // Neutral/Idle gestures
  { name: "relax", path: "/animations/Relax.vrma", triggerEmotions: ["neutral"], priority: 5 },
  { name: "sleepy", path: "/animations/Sleepy.vrma", triggerEmotions: ["neutral"], priority: 4 },

  // === Mixamo FBX Animations (hold poses) ===
  { name: "crouch", path: "/animations/crouch.fbx", triggerEmotions: [], priority: 0, isHoldPose: true },
  { name: "lay", path: "/animations/lay.fbx", triggerEmotions: [], priority: 0, isHoldPose: true },
  { name: "stand1", path: "/animations/stand1.fbx", triggerEmotions: [], priority: 0, isHoldPose: true },
];

export interface GestureManagerConfig {
  /** Probability of triggering a gesture (0-1) */
  gestureChance: number;
  /** Minimum time between gestures in seconds */
  minGestureInterval: number;
  /** Maximum time between gestures in seconds */
  maxGestureInterval: number;
  /** Enable automatic random gestures */
  autoRandomGestures: boolean;
}

export class GestureManager {
  private vrm: VRM;
  private config: GestureManagerConfig;
  private loadedGestures: Map<GestureName, THREE.AnimationClip> = new Map();
  private mixer: THREE.AnimationMixer;
  private currentAction: THREE.AnimationAction | null = null;
  private currentGestureName: GestureName | null = null;
  private lastGestureTime: number = 0;
  private nextGestureTime: number = 0;
  private currentEmotion: EmotionType = "neutral";

  constructor(vrm: VRM, config: Partial<GestureManagerConfig> = {}) {
    this.vrm = vrm;
    this.config = {
      gestureChance: 0.3,
      minGestureInterval: 8,
      maxGestureInterval: 15,
      autoRandomGestures: true,
      ...config,
    };
    this.mixer = new THREE.AnimationMixer(vrm.scene);
    this.scheduleNextGesture();
  }

  /**
   * Load a single gesture animation
   * Automatically detects format (VRMA vs Mixamo FBX) based on file extension
   */
  async loadGesture(gesture: GestureConfig): Promise<void> {
    try {
      let clip: THREE.AnimationClip | null = null;

      if (isVRMAFile(gesture.path)) {
        // Load VRM-native animation
        clip = await loadVRMAAnimation(gesture.path, this.vrm);
      } else {
        // Load Mixamo FBX animation
        clip = await loadMixamoAnimation(gesture.path, this.vrm);
      }

      if (clip) {
        this.loadedGestures.set(gesture.name, clip);
        console.log(`✓ Loaded gesture: ${gesture.name} (${isVRMAFile(gesture.path) ? 'VRMA' : 'Mixamo'})`);
      }
    } catch (error) {
      console.warn(`Failed to load gesture ${gesture.name}:`, error);
    }
  }

  /**
   * Load all gesture animations
   */
  async loadAllGestures(): Promise<void> {
    console.log("Loading gesture animations...");
    const loadPromises = GESTURE_CONFIGS.map((config) => this.loadGesture(config));
    await Promise.allSettled(loadPromises);
    console.log(`✓ Loaded ${this.loadedGestures.size}/${GESTURE_CONFIGS.length} gestures`);
  }

  /**
   * Update current emotion (affects which gestures can be triggered)
   */
  setEmotion(emotion: EmotionType): void {
    this.currentEmotion = emotion;
  }

  /**
   * Manually trigger a specific gesture
   * @param gestureName The gesture to play
   * @param fadeInDuration Duration of fade-in transition (longer = smoother)
   */
  playGesture(gestureName: GestureName, fadeInDuration: number = 0.5): boolean {
    const clip = this.loadedGestures.get(gestureName);
    if (!clip) {
      console.warn(`Gesture ${gestureName} not loaded`);
      return false;
    }

    // Find config for this gesture
    const config = GESTURE_CONFIGS.find(c => c.name === gestureName);
    const isHoldPose = config?.isHoldPose ?? false;

    // Stop current gesture with smooth crossfade
    if (this.currentAction) {
      this.currentAction.fadeOut(fadeInDuration);
    }

    // Play new gesture
    const action = this.mixer.clipAction(clip);
    action.reset();

    if (isHoldPose) {
      // Hold poses: loop and clamp at end for static pose
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true; // Hold the final pose
    } else {
      // Regular gestures: play once and return to rest
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = false;
    }

    // Smooth fade-in for realistic transition
    action.fadeIn(fadeInDuration);
    action.play();

    this.currentAction = action;
    this.currentGestureName = gestureName;
    this.lastGestureTime = Date.now();
    this.scheduleNextGesture();

    // Only auto fade-out for non-hold poses
    if (!isHoldPose) {
      const fadeOutDuration = 0.5;
      const gestureEndTime = clip.duration * 1000 - fadeOutDuration * 1000;
      setTimeout(() => {
        if (this.currentAction === action) {
          action.fadeOut(fadeOutDuration);
          this.currentAction = null;
          this.currentGestureName = null;
        }
      }, Math.max(0, gestureEndTime));
    }

    console.log(`▶ Playing gesture: ${gestureName}${isHoldPose ? ' (holding)' : ''}`);
    return true;
  }

  /**
   * Return to rest pose from a hold pose
   */
  returnToRest(fadeOutDuration: number = 0.8): void {
    if (this.currentAction) {
      console.log(`↩ Returning to rest pose from: ${this.currentGestureName}`);
      this.currentAction.fadeOut(fadeOutDuration);
      this.currentAction = null;
      this.currentGestureName = null;
    }
  }

  /**
   * Get current gesture name (if any)
   */
  getCurrentGesture(): GestureName | null {
    return this.currentGestureName;
  }

  /**
   * Trigger a random gesture appropriate for current emotion
   */
  playRandomGesture(): boolean {
    const availableGestures = GESTURE_CONFIGS.filter((config) =>
      config.triggerEmotions.includes(this.currentEmotion)
    );

    if (availableGestures.length === 0) {
      return false;
    }

    // Weight by priority
    const totalPriority = availableGestures.reduce((sum, g) => sum + g.priority, 0);
    let random = Math.random() * totalPriority;

    for (const gesture of availableGestures) {
      random -= gesture.priority;
      if (random <= 0) {
        return this.playGesture(gesture.name);
      }
    }

    // Fallback to first gesture
    return this.playGesture(availableGestures[0].name);
  }

  /**
   * Update animation mixer (call in animation loop)
   */
  update(deltaTime: number): void {
    this.mixer.update(deltaTime);

    // Auto-trigger random gestures
    if (this.config.autoRandomGestures && Date.now() >= this.nextGestureTime) {
      if (Math.random() < this.config.gestureChance) {
        this.playRandomGesture();
      } else {
        this.scheduleNextGesture();
      }
    }
  }

  /**
   * Schedule the next automatic gesture
   */
  private scheduleNextGesture(): void {
    const interval =
      this.config.minGestureInterval +
      Math.random() * (this.config.maxGestureInterval - this.config.minGestureInterval);
    this.nextGestureTime = Date.now() + interval * 1000;
  }

  /**
   * Stop all gestures
   */
  stopAllGestures(): void {
    if (this.currentAction) {
      this.currentAction.fadeOut(0.3);
      this.currentAction = null;
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stopAllGestures();
    this.mixer.stopAllAction();
    this.loadedGestures.clear();
  }
}
