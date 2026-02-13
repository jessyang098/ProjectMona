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
  | "blush"
  | "sad"
  | "angry"
  | "sleepy"
  | "lay"
  | "standing_idle"
  | "talking_idle"
  | "thinking"
  | "temp_idle";

interface GestureConfig {
  name: GestureName;
  path: string;
  triggerEmotions: EmotionType[];
  priority: number; // Higher = more likely to play
  duration?: number; // Optional override
  isHoldPose?: boolean; // If true, holds the pose until manually stopped
  isLoopingIdle?: boolean; // If true, loops continuously (for idle animations)
}

const GESTURE_CONFIGS: GestureConfig[] = [
  // === VRMA (VRM-native) Animations ===
  { name: "wave", path: "/animations/Goodbye.vrma", triggerEmotions: ["happy", "excited"], priority: 10 },
  { name: "goodbye", path: "/animations/Goodbye.vrma", triggerEmotions: [], priority: 10 },
  { name: "blush", path: "/animations/Sleepy.vrma", triggerEmotions: ["embarrassed"], priority: 8 },
  { name: "sad", path: "/animations/Sad.vrma", triggerEmotions: ["sad", "concerned"], priority: 7 },
  { name: "angry", path: "/animations/Sad.vrma", triggerEmotions: ["annoyed", "frustrated"], priority: 7 },
  { name: "sleepy", path: "/animations/Sleepy.vrma", triggerEmotions: ["neutral"], priority: 4 },

  // === Mixamo FBX Animations ===
  { name: "standing_idle", path: "/animations/standing-idle.fbx", triggerEmotions: [], priority: 0, isLoopingIdle: true },
  { name: "temp_idle", path: "/animations/temp-idle.fbx", triggerEmotions: [], priority: 0, isLoopingIdle: true },
  { name: "talking_idle", path: "/animations/Talking.fbx", triggerEmotions: [], priority: 0, isLoopingIdle: true },
  { name: "thinking", path: "/animations/Thinking.fbx", triggerEmotions: [], priority: 0, isHoldPose: true },
  { name: "lay", path: "/animations/lay.fbx", triggerEmotions: [], priority: 0, isHoldPose: true },
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
      }
    } catch (error) {
      // Silently handle loading errors
    }
  }

  /**
   * Load all gesture animations
   */
  async loadAllGestures(): Promise<void> {
    const loadPromises = GESTURE_CONFIGS.map((config) => this.loadGesture(config));
    await Promise.allSettled(loadPromises);
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
      return false;
    }

    // Find config for this gesture
    const config = GESTURE_CONFIGS.find(c => c.name === gestureName);
    const isHoldPose = config?.isHoldPose ?? false;
    const isLoopingIdle = config?.isLoopingIdle ?? false;

    // Stop current gesture with smooth crossfade
    if (this.currentAction) {
      this.currentAction.fadeOut(fadeInDuration);
    }

    // Play new gesture
    const action = this.mixer.clipAction(clip);
    action.reset();

    if (isLoopingIdle) {
      // Looping idle: plays continuously forever
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    } else if (isHoldPose) {
      // Hold poses: play once and clamp at end for static pose
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

    // Only auto fade-out for non-hold, non-looping poses
    if (!isHoldPose && !isLoopingIdle) {
      const fadeOutDuration = 0.5;
      const gestureEndTime = clip.duration * 1000 - fadeOutDuration * 1000;
      setTimeout(() => {
        if (this.currentAction === action) {
          // Return to standing idle instead of T-posing
          this.returnToIdle(fadeOutDuration);
        }
      }, Math.max(0, gestureEndTime));
    }

    return true;
  }

  /**
   * Return to standing idle animation
   */
  returnToIdle(fadeInDuration: number = 0.5): void {
    // Using riko_idle for testing — switch to "standing_idle" to revert
    this.playGesture("temp_idle", fadeInDuration);
  }

  /**
   * Return to rest pose from a hold pose (legacy - now returns to idle)
   */
  returnToRest(fadeOutDuration: number = 0.8): void {
    this.returnToIdle(fadeOutDuration);
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
