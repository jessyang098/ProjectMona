/**
 * Global animation state for sharing current animation info across components
 * Uses a simple pub/sub pattern to avoid prop drilling through R3F context
 */

export interface AnimationState {
  currentAnimation: string | null;
  isPlaying: boolean;
}

type AnimationStateListener = (state: AnimationState) => void;

// Global state
let currentState: AnimationState = {
  currentAnimation: null,
  isPlaying: false,
};

const listeners: Set<AnimationStateListener> = new Set();

/**
 * Update the current animation state and notify all listeners
 */
export function setAnimationState(animation: string | null, isPlaying: boolean = true): void {
  currentState = {
    currentAnimation: animation,
    isPlaying,
  };
  listeners.forEach((listener) => listener(currentState));
}

/**
 * Get the current animation state
 */
export function getAnimationState(): AnimationState {
  return currentState;
}

/**
 * Subscribe to animation state changes
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToAnimationState(listener: AnimationStateListener): () => void {
  listeners.add(listener);
  // Immediately call with current state
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}
