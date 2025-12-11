/**
 * Pose Command Event System
 * Allows triggering poses from anywhere in the app via custom events
 */

import type { GestureName } from "./animation/gestureManager";

export type PoseCommand = {
  type: "play" | "stop";
  pose?: GestureName;
};

const POSE_EVENT = "mona:pose";

/**
 * Trigger a pose animation
 */
export function triggerPose(pose: GestureName): void {
  window.dispatchEvent(
    new CustomEvent<PoseCommand>(POSE_EVENT, {
      detail: { type: "play", pose },
    })
  );
  console.log(`🎭 Pose command: play ${pose}`);
}

/**
 * Return to rest pose
 */
export function returnToRest(): void {
  window.dispatchEvent(
    new CustomEvent<PoseCommand>(POSE_EVENT, {
      detail: { type: "stop" },
    })
  );
  console.log(`🎭 Pose command: return to rest`);
}

/**
 * Listen for pose commands
 */
export function onPoseCommand(callback: (command: PoseCommand) => void): () => void {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<PoseCommand>;
    callback(customEvent.detail);
  };
  window.addEventListener(POSE_EVENT, handler);
  return () => window.removeEventListener(POSE_EVENT, handler);
}

/**
 * Parse test commands from user input
 * Returns the remaining message (without command) or null if it was a command-only message
 */
export function parseTestCommand(input: string): { command: PoseCommand | null; remainingText: string | null } {
  const trimmed = input.trim().toLowerCase();

  // Check for test: prefix commands
  if (trimmed.startsWith("test:")) {
    const command = trimmed.slice(5).trim();

    switch (command) {
      case "crouch":
        return { command: { type: "play", pose: "crouch" }, remainingText: null };
      case "lay":
        return { command: { type: "play", pose: "lay" }, remainingText: null };
      case "stand":
      case "stand1":
        return { command: { type: "play", pose: "stand1" }, remainingText: null };
      case "wave":
        return { command: { type: "play", pose: "wave" }, remainingText: null };
      case "rest":
      case "stop":
        return { command: { type: "stop" }, remainingText: null };
      default:
        console.warn(`Unknown test command: ${command}`);
        return { command: null, remainingText: input };
    }
  }

  return { command: null, remainingText: input };
}
