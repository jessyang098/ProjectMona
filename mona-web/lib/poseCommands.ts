/**
 * Pose & Expression Command Event System
 * Allows triggering poses and expressions from anywhere in the app via custom events
 */

import type { GestureName } from "./animation/gestureManager";
import type { LipSyncCue } from "@/types/chat";

export type PoseCommand = {
  type: "play" | "stop";
  pose?: GestureName;
};

export type ExpressionCommand = {
  type: "set" | "clear";
  expression?: string;
  weight?: number;
};

export type SpeakCommand = {
  text: string;
  lipSync: LipSyncCue[];
  audioUrl?: string;  // Optional pre-recorded audio file
};

const POSE_EVENT = "mona:pose";
const EXPRESSION_EVENT = "mona:expression";
const SPEAK_EVENT = "mona:speak";

// All available Moe.vrm expressions (case-sensitive!)
const VALID_EXPRESSIONS = [
  "neutral", "happy", "angry", "sad", "relaxed",
  "blink", "blinkleft", "blinkright",  // lowercase for user input
  "lookup", "lookdown", "lookleft", "lookright",
  "aa", "ih", "ou", "ee", "oh",
  "special", "cheekpuff",
];

// Map user input (lowercase) to actual VRM expression names (case-sensitive)
const EXPRESSION_NAME_MAP: Record<string, string> = {
  "blinkleft": "blinkLeft",
  "blinkright": "blinkRight",
  "lookup": "lookUp",
  "lookdown": "lookDown",
  "lookleft": "lookLeft",
  "lookright": "lookRight",
  "special": "Special",
  "cheekpuff": "CheekPuff",
};

/**
 * Trigger a pose animation
 */
export function triggerPose(pose: GestureName): void {
  window.dispatchEvent(
    new CustomEvent<PoseCommand>(POSE_EVENT, {
      detail: { type: "play", pose },
    })
  );
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
 * Generate fake lip sync cues based on text length
 * This creates a pattern of mouth movements for testing
 */
function generateTestLipSync(text: string, durationSeconds: number): LipSyncCue[] {
  const cues: LipSyncCue[] = [];
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordDuration = durationSeconds / words.length;

  let currentTime = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const syllables = Math.max(1, Math.ceil(word.length / 3)); // Rough syllable estimate
    const syllableDuration = wordDuration / syllables;

    for (let s = 0; s < syllables; s++) {
      // Vary mouth shapes based on position
      const shape = ["D", "C", "E", "F", "B"][s % 5];
      const phonemes = SHAPE_TO_PHONEMES[shape];

      cues.push({
        start: currentTime,
        end: currentTime + syllableDuration * 0.7, // Leave gap for closing
        shape,
        phonemes,
      });

      // Add brief silence between syllables
      cues.push({
        start: currentTime + syllableDuration * 0.7,
        end: currentTime + syllableDuration,
        shape: "X",
        phonemes: { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 },
      });

      currentTime += syllableDuration;
    }

    // Add pause between words
    if (i < words.length - 1) {
      cues.push({
        start: currentTime,
        end: currentTime + 0.1,
        shape: "X",
        phonemes: { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 },
      });
      currentTime += 0.1;
    }
  }

  return cues;
}

// Phoneme mappings matching backend lip_sync.py
const SHAPE_TO_PHONEMES: Record<string, { aa: number; ee: number; ih: number; oh: number; ou: number }> = {
  "A": { aa: 0.0, ee: 0.0, ih: 0.0, oh: 0.0, ou: 0.15 },
  "B": { aa: 0.4, ee: 0.0, ih: 0.25, oh: 0.0, ou: 0.0 },
  "C": { aa: 0.25, ee: 0.85, ih: 0.2, oh: 0.0, ou: 0.0 },
  "D": { aa: 0.9, ee: 0.0, ih: 0.1, oh: 0.0, ou: 0.0 },
  "E": { aa: 0.55, ee: 0.0, ih: 0.0, oh: 0.75, ou: 0.0 },
  "F": { aa: 0.2, ee: 0.0, ih: 0.0, oh: 0.2, ou: 0.8 },
  "X": { aa: 0.0, ee: 0.0, ih: 0.0, oh: 0.0, ou: 0.0 },
};

/**
 * Trigger test speech - dispatches event for VRMAvatar to handle
 * Uses pre-recorded test audio if available, otherwise falls back to Web Speech API
 */
export function triggerTestSpeak(text: string): void {
  // Check for test audio file in public folder
  const testAudioUrl = "/audio/test-greeting.mp3";

  // Estimate duration based on text length
  const wordsPerSecond = 2.5;
  const wordCount = text.split(/\s+/).length;
  const estimatedDuration = wordCount / wordsPerSecond;

  // Generate lip sync cues
  const lipSync = generateTestLipSync(text, estimatedDuration);

  // Dispatch speak event for the avatar to handle
  window.dispatchEvent(
    new CustomEvent<SpeakCommand>(SPEAK_EVENT, {
      detail: { text, lipSync, audioUrl: testAudioUrl },
    })
  );
}

/**
 * Listen for speak commands
 */
export function onSpeakCommand(callback: (command: SpeakCommand) => void): () => void {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<SpeakCommand>;
    callback(customEvent.detail);
  };
  window.addEventListener(SPEAK_EVENT, handler);
  return () => window.removeEventListener(SPEAK_EVENT, handler);
}

// Default test paragraph for lip sync testing
const TEST_PARAGRAPH = "Hello! I'm Mona, your virtual companion. I love chatting with you and learning about your day. How are you feeling today? I hope you're having a wonderful time!";

/**
 * Parse test commands from user input
 * Supports:
 *   - test:<pose> - Play a pose (e.g., "test:wave", "test:idle")
 *   - test:expr:<expression> - Set expression (e.g., "test:expr:joy", "test:expr:cheekpuff")
 *   - test:expr:clear - Clear all expressions
 *   - test:speak - Speak a test paragraph (for lip sync testing without backend)
 *   - test:speak:<custom text> - Speak custom text
 * Returns the remaining message (without command) or null if it was a command-only message
 */
export function parseTestCommand(input: string): {
  command: PoseCommand | null;
  expressionCommand: ExpressionCommand | null;
  speakCommand: boolean;
  speakText: string | null;
  remainingText: string | null;
} {
  const trimmed = input.trim();
  const lowerTrimmed = trimmed.toLowerCase();

  // Check for test: prefix commands
  if (lowerTrimmed.startsWith("test:")) {
    const command = lowerTrimmed.slice(5).trim();

    // Check for speak commands: test:speak or test:speak:<text>
    if (command === "speak" || command.startsWith("speak:")) {
      const customText = command.startsWith("speak:") ? trimmed.slice(11).trim() : null;
      const textToSpeak = customText || TEST_PARAGRAPH;
      return {
        command: null,
        expressionCommand: null,
        speakCommand: true,
        speakText: textToSpeak,
        remainingText: null,
      };
    }

    // Check for expression commands: test:expr:<name>
    if (command.startsWith("expr:")) {
      const exprName = command.slice(5).trim();

      if (exprName === "clear") {
        return { command: null, expressionCommand: { type: "clear" }, speakCommand: false, speakText: null, remainingText: null };
      }

      if (exprName) {
        // Map to actual expression name (VRM names are case-sensitive, Live2D uses snake_case)
        const actualName = EXPRESSION_NAME_MAP[exprName] ?? exprName;
        return { command: null, expressionCommand: { type: "set", expression: actualName, weight: 1.0 }, speakCommand: false, speakText: null, remainingText: null };
      }

      return { command: null, expressionCommand: null, speakCommand: false, speakText: null, remainingText: input };
    }

    // Pose commands
    switch (command) {
      case "wave":
        return { command: { type: "play", pose: "wave" }, expressionCommand: null, speakCommand: false, speakText: null, remainingText: null };
      case "goodbye":
        return { command: { type: "play", pose: "goodbye" }, expressionCommand: null, speakCommand: false, speakText: null, remainingText: null };
      case "sad":
        return { command: { type: "play", pose: "sad" }, expressionCommand: null, speakCommand: false, speakText: null, remainingText: null };
      case "angry":
        return { command: { type: "play", pose: "angry" }, expressionCommand: null, speakCommand: false, speakText: null, remainingText: null };
      case "blush":
        return { command: { type: "play", pose: "blush" }, expressionCommand: null, speakCommand: false, speakText: null, remainingText: null };
      case "sleepy":
        return { command: { type: "play", pose: "sleepy" }, expressionCommand: null, speakCommand: false, speakText: null, remainingText: null };
      case "lay":
        return { command: { type: "play", pose: "lay" }, expressionCommand: null, speakCommand: false, speakText: null, remainingText: null };
      case "standing_idle":
      case "standing-idle":
      case "idle":
        return { command: { type: "play", pose: "standing_idle" }, expressionCommand: null, speakCommand: false, speakText: null, remainingText: null };
      case "rest":
      case "stop":
        return { command: { type: "stop" }, expressionCommand: null, speakCommand: false, speakText: null, remainingText: null };
      default:
        return { command: null, expressionCommand: null, speakCommand: false, speakText: null, remainingText: input };
    }
  }

  return { command: null, expressionCommand: null, speakCommand: false, speakText: null, remainingText: input };
}
