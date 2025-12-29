"use client";

import { useState, useEffect } from "react";
import { subscribeToAnimationState, type AnimationState } from "@/lib/animationState";

/**
 * Hook to subscribe to global animation state changes
 * Returns the current animation name and playing status
 */
export function useAnimationState(): AnimationState {
  const [state, setState] = useState<AnimationState>({
    currentAnimation: null,
    isPlaying: false,
  });

  useEffect(() => {
    const unsubscribe = subscribeToAnimationState((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, []);

  return state;
}
