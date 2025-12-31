/**
 * Pose & Expression Command Event System
 * Allows triggering poses and expressions from anywhere in the app via custom events
 */

import type { GestureName } from "./animation/gestureManager";

export type PoseCommand = {
  type: "play" | "stop";
  pose?: GestureName;
};

export type ExpressionCommand = {
  type: "set" | "clear";
  expression?: string;
  weight?: number;
};

const POSE_EVENT = "mona:pose";
const EXPRESSION_EVENT = "mona:expression";

// All available VRM expressions
const VALID_EXPRESSIONS = [
  "neutral", "joy", "angry", "sorrow", "fun",
  "blink", "blink_l", "blink_r",
  "lookup", "lookdown", "lookleft", "lookright",
  "a", "i", "u", "e", "o",
  "special", "cheekpuff",
];

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
 * Trigger an expression
 */
export function triggerExpression(expression: string, weight: number = 1.0): void {
  window.dispatchEvent(
    new CustomEvent<ExpressionCommand>(EXPRESSION_EVENT, {
      detail: { type: "set", expression, weight },
    })
  );
  console.log(`😊 Expression command: set ${expression} to ${weight}`);
}

/**
 * Clear all expressions
 */
export function clearExpressions(): void {
  window.dispatchEvent(
    new CustomEvent<ExpressionCommand>(EXPRESSION_EVENT, {
      detail: { type: "clear" },
    })
  );
  console.log(`😊 Expression command: clear all`);
}

/**
 * Listen for expression commands
 */
export function onExpressionCommand(callback: (command: ExpressionCommand) => void): () => void {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<ExpressionCommand>;
    callback(customEvent.detail);
  };
  window.addEventListener(EXPRESSION_EVENT, handler);
  return () => window.removeEventListener(EXPRESSION_EVENT, handler);
}

/**
 * Parse test commands from user input
 * Supports:
 *   - test:<pose> - Play a pose (e.g., "test:wave", "test:idle")
 *   - test:expr:<expression> - Set expression (e.g., "test:expr:joy", "test:expr:cheekpuff")
 *   - test:expr:clear - Clear all expressions
 * Returns the remaining message (without command) or null if it was a command-only message
 */
export function parseTestCommand(input: string): {
  command: PoseCommand | null;
  expressionCommand: ExpressionCommand | null;
  remainingText: string | null;
} {
  const trimmed = input.trim().toLowerCase();

  // Check for test: prefix commands
  if (trimmed.startsWith("test:")) {
    const command = trimmed.slice(5).trim();

    // Check for expression commands: test:expr:<name>
    if (command.startsWith("expr:")) {
      const exprName = command.slice(5).trim();

      if (exprName === "clear") {
        return { command: null, expressionCommand: { type: "clear" }, remainingText: null };
      }

      if (VALID_EXPRESSIONS.includes(exprName)) {
        // VRM 0.x expressions are lowercase - just use the name directly
        return { command: null, expressionCommand: { type: "set", expression: exprName, weight: 1.0 }, remainingText: null };
      }

      console.warn(`Unknown expression: ${exprName}. Valid: ${VALID_EXPRESSIONS.join(", ")}`);
      return { command: null, expressionCommand: null, remainingText: input };
    }

    // Pose commands
    switch (command) {
      case "standing_idle":
      case "standing-idle":
      case "idle":
        return { command: { type: "play", pose: "standing_idle" }, expressionCommand: null, remainingText: null };
      case "default":
        return { command: { type: "play", pose: "default" }, expressionCommand: null, remainingText: null };
      case "crouch":
        return { command: { type: "play", pose: "crouch" }, expressionCommand: null, remainingText: null };
      case "lay":
        return { command: { type: "play", pose: "lay" }, expressionCommand: null, remainingText: null };
      case "stand":
        return { command: { type: "play", pose: "stand" }, expressionCommand: null, remainingText: null };
      case "stand1":
        return { command: { type: "play", pose: "stand1" }, expressionCommand: null, remainingText: null };
      case "wave":
        return { command: { type: "play", pose: "wave" }, expressionCommand: null, remainingText: null };
      case "rest":
      case "stop":
        return { command: { type: "stop" }, expressionCommand: null, remainingText: null };
      default:
        console.warn(`Unknown test command: ${command}`);
        return { command: null, expressionCommand: null, remainingText: input };
    }
  }

  return { command: null, expressionCommand: null, remainingText: input };
}
