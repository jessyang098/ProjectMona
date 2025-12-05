/**
 * Gesture Animation Manager
 * Handles loading and triggering Mixamo gesture animations based on emotions
 */

import * as THREE from "three";
import { VRM } from "@pixiv/three-vrm";
import { loadMixamoAnimation } from "./mixamoLoader";

export type EmotionType = "happy" | "excited" | "curious" | "embarrassed" | "sad" | "concerned" | "neutral";
export type GestureName =
  | "wave"
  | "nod"
  | "thinking"
  | "excited_jump"
  | "shy_gesture"
  | "sad_idle"
  | "looking_around"
  | "dismissing"
  | "standing_idle";

interface GestureConfig {
  name: GestureName;
  path: string;
  triggerEmotions: EmotionType[];
  priority: number; // Higher = more likely to play
  duration?: number; // Optional override
}

const GESTURE_CONFIGS: GestureConfig[] = [
  // Happy/Excited gestures
  { name: "wave", path: "/animations/wave.fbx", triggerEmotions: ["happy", "excited"], priority: 8 },
  { name: "excited_jump", path: "/animations/excited.fbx", triggerEmotions: ["excited"], priority: 9 },

  // Curious gestures
  { name: "thinking", path: "/animations/thinking.fbx", triggerEmotions: ["curious"], priority: 7 },
  { name: "looking_around", path: "/animations/looking_around.fbx", triggerEmotions: ["curious"], priority: 6 },

  // Embarrassed gestures
  { name: "shy_gesture", path: "/animations/shy.fbx", triggerEmotions: ["embarrassed"], priority: 8 },
  { name: "dismissing", path: "/animations/dismissing.fbx", triggerEmotions: ["embarrassed"], priority: 7 },

  // Sad/Concerned gestures
  { name: "sad_idle", path: "/animations/sad_idle.fbx", triggerEmotions: ["sad", "concerned"], priority: 6 },

  // Neutral fallback
  { name: "standing_idle", path: "/animations/standing_idle.fbx", triggerEmotions: ["neutral"], priority: 5 },
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
   */
  async loadGesture(gesture: GestureConfig): Promise<void> {
    try {
      const clip = await loadMixamoAnimation(gesture.path, this.vrm);
      if (clip) {
        this.loadedGestures.set(gesture.name, clip);
        console.log(`✓ Loaded gesture: ${gesture.name}`);
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
   */
  playGesture(gestureName: GestureName, fadeInDuration: number = 0.3): boolean {
    const clip = this.loadedGestures.get(gestureName);
    if (!clip) {
      console.warn(`Gesture ${gestureName} not loaded`);
      return false;
    }

    // Stop current gesture if playing
    if (this.currentAction) {
      this.currentAction.fadeOut(0.2);
    }

    // Play new gesture
    const action = this.mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.fadeIn(fadeInDuration);
    action.play();

    this.currentAction = action;
    this.lastGestureTime = Date.now();
    this.scheduleNextGesture();

    console.log(`▶ Playing gesture: ${gestureName}`);
    return true;
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
