"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import type { EmotionData, LipSyncCue } from "@/types/chat";
import * as THREE from "three";
import { VRMLookAtQuaternionProxy } from "@pixiv/three-vrm-animation";
import { LipSyncManager } from "@/lib/animation";
import { GestureManager, type EmotionType, type GestureName } from "@/lib/animation/gestureManager";
import { onPoseCommand, onExpressionCommand, type PoseCommand, type ExpressionCommand } from "@/lib/poseCommands";
import { setAnimationState } from "@/lib/animationState";

// Procedural animation configuration
const ANIMATION_CONFIG = {
  // Blinking behavior
  blink: {
    minInterval: 0.5,
    maxInterval: 3.0,
    speed: 8.0,
    duration: 0.1,
  },
  // Head movement ranges and timing (idle vs talking)
  head: {
    nodRange: 0.2,
    turnRange: 0.13,
    tiltRange: 0.15,
    // Idle: slower, less frequent movements
    idleFrequency: 1.8,
    idleSmoothing: 0.02,
    // Talking: faster, more dynamic movements
    talkFrequency: 0.8,
    talkSmoothing: 0.04,
  },
  // Torso movement for subtle breathing/sway effect (idle vs talking)
  torso: {
    swayRange: 0.08, // More noticeable sway like Riko (0.1 was too much)
    // Idle: slow, gentle breathing
    idleFrequency: 2.8,
    idleSmoothing: 0.01,
    // Talking: slightly more animated
    talkFrequency: 1.8,
    talkSmoothing: 0.02,
  },
} as const;

// Per-avatar configuration for different VRM models
const AVATAR_CONFIGS: Record<string, { scale: number; position: [number, number, number]; rotateY: number }> = {
  // Moe.vrm - new contractor avatar, needs 180 rotation and smaller scale
  "Moe.vrm": { scale: 0.85, position: [0, 0.10, 0], rotateY: Math.PI },
  "/avatars/Moe.vrm": { scale: 0.85, position: [0, 0.10, 0], rotateY: Math.PI },
  // Mona1.vrm - original avatar, no rotation needed
  "Mona1.vrm": { scale: 0.95, position: [0, 0.10, 0], rotateY: 0 },
  "/avatars/Mona1.vrm": { scale: 0.95, position: [0, 0.10, 0], rotateY: 0 },
};

// Default config for unknown avatars
const DEFAULT_AVATAR_CONFIG = { scale: 0.95, position: [0, 0.10, 0] as [number, number, number], rotateY: 0 };

// Map backend emotions to VRM 0.x expression names
// Moe.vrm expressions: Neutral, A, I, U, E, O, Blink, Blink_L, Blink_R,
// Joy, Angry, Sorrow, Fun, LookUp, LookDown, LookLeft, LookRight,
// ChangeColor, Lencerie, Mouth#1-5, Special, CheekPuff
const emotionToExpression: Record<string, string> = {
  // Positive emotions
  happy: "Joy",
  excited: "Fun",
  content: "Joy",
  affectionate: "Joy",
  playful: "Fun",

  // Neutral/Mixed emotions
  curious: "Neutral",
  surprised: "Fun",      // No dedicated surprised, Fun works
  embarrassed: "Special", // Special expression (likely blush)
  confused: "Neutral",
  bored: "Neutral",
  neutral: "Neutral",

  // Negative emotions
  concerned: "Sorrow",
  sad: "Sorrow",
  annoyed: "CheekPuff",  // Puffed cheeks for pouty/annoyed
  angry: "Angry",
  frustrated: "Angry",
};

// All available VRM expressions for testing
// Use with test:expr:<name> in chat (e.g., "test:expr:Joy", "test:expr:CheekPuff")
export const ALL_EXPRESSIONS = [
  "Neutral", "Joy", "Angry", "Sorrow", "Fun",
  "Blink", "Blink_L", "Blink_R",
  "LookUp", "LookDown", "LookLeft", "LookRight",
  "A", "I", "U", "E", "O",
  "Special", "CheekPuff",
] as const;

// Outfit visibility configuration
export interface OutfitVisibility {
  shirt: boolean;
  skirt: boolean;
  socks: boolean;
  shoes: boolean;
  colorVariant: boolean; // Toggle for ChangeColor expression (alternate color scheme)
  lingerie: boolean; // Toggle for Lencerie expression
}

interface VRMAvatarProps {
  url: string;
  emotion: EmotionData | null;
  audioUrl?: string | null;
  lipSync?: LipSyncCue[];
  outfitVisibility?: OutfitVisibility;
}

const DEFAULT_OUTFIT: OutfitVisibility = {
  shirt: true,
  skirt: true,
  socks: true,
  shoes: true,
  colorVariant: false,
  lingerie: false,
};

export default function VRMAvatar({ url, emotion, audioUrl, lipSync, outfitVisibility = DEFAULT_OUTFIT }: VRMAvatarProps) {
  console.log("🎭 VRMAvatar rendered with audioUrl:", audioUrl, "lipSync:", lipSync?.length ?? 0, "cues");

  const groupRef = useRef<THREE.Group>(null);
  const hipsRef = useRef<THREE.Object3D | null>(null);
  const chestRef = useRef<THREE.Object3D | null>(null);
  const headRef = useRef<THREE.Object3D | null>(null);
  const neckRef = useRef<THREE.Object3D | null>(null);
  const spineRef = useRef<THREE.Object3D | null>(null);
  const leftUpperArmRef = useRef<THREE.Object3D | null>(null);
  const rightUpperArmRef = useRef<THREE.Object3D | null>(null);
  const lipSyncRef = useRef<LipSyncManager | null>(null);
  const gestureManagerRef = useRef<GestureManager | null>(null);
  const currentAudioRef = useRef<string | null>(null);
  const lastPublishedGestureRef = useRef<string | null>(null);

  const baseRotations = useRef({
    hips: new THREE.Euler(),
    chest: new THREE.Euler(),
    head: new THREE.Euler(),
    leftUpperArm: new THREE.Euler(),
    rightUpperArm: new THREE.Euler(),
  });

  // Animation state for procedural idle behaviors
  const animationState = useRef({
    head: {
      timer: 0,
      nextChange: 0,
      targetRotation: { x: 0, y: 0, z: 0 },
      currentRotation: { x: 0, y: 0, z: 0 },
    },
    torso: {
      timer: 0,
      nextChange: 0,
      targetRotation: { x: 0 },
      currentRotation: { x: 0 },
    },
    eyes: {
      timer: 0,
      nextBlink: 0,
      blinkAmount: 0,
    },
  });
  const gltf = useLoader(
    GLTFLoader,
    url,
    (loader) => loader.register((parser) => new VRMLoaderPlugin(parser))
  );

  const vrm = useMemo(() => gltf.userData.vrm as VRM | undefined, [gltf]);

  useEffect(() => {
    if (!vrm || !groupRef.current) return;
    const group = groupRef.current;

    // VRMUtils performance optimizations (from riko project)
    // These significantly improve rendering performance
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.combineMorphs(vrm);

    // Add VRMLookAtQuaternionProxy for eye tracking support in animations
    if (vrm.lookAt) {
      const lookAtQuatProxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
      lookAtQuatProxy.name = 'lookAtQuaternionProxy';
      vrm.scene.add(lookAtQuatProxy);
    }

    group.add(vrm.scene);

    // Apply per-avatar configuration
    const avatarConfig = AVATAR_CONFIGS[url] || DEFAULT_AVATAR_CONFIG;
    vrm.scene.rotation.y = avatarConfig.rotateY;
    vrm.scene.scale.setScalar(avatarConfig.scale);
    vrm.scene.position.set(...avatarConfig.position);
    console.log("🎭 Applied avatar config for:", url, avatarConfig);
    // Log all meshes
    const meshNames: string[] = [];
    vrm.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        meshNames.push(mesh.name);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.material && "toneMapped" in mesh.material) {
          (mesh.material as THREE.Material & { toneMapped?: boolean }).toneMapped = true;
        }
      }
    });
    console.log("🎭 VRM Meshes found:", meshNames);

    // Log all blend shapes/expressions with full details
    if (vrm.expressionManager) {
      const expressions = vrm.expressionManager.expressions;
      console.log("🎭 VRM Expressions available:", expressions.map(e => e.expressionName));

      // Log detailed info about each expression
      console.log("🎭 VRM Expression Details:");
      expressions.forEach(expr => {
        const binds = (expr as unknown as { _binds?: Array<{ type: string; index?: number; weight?: number }> })._binds || [];
        console.log(`  - ${expr.expressionName}: ${binds.length} morph target binds`);
      });

      // Also log the morph targets from the meshes directly
      console.log("🎭 Mesh Morph Targets (blend shapes):");
      vrm.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          const morphDict = mesh.morphTargetDictionary;
          if (morphDict && Object.keys(morphDict).length > 0) {
            console.log(`  Mesh "${mesh.name}":`, Object.keys(morphDict));
          }
        }
      });
    }

    const humanoid = vrm.humanoid;

    // Get all bones we need
    hipsRef.current = humanoid?.getNormalizedBoneNode("hips") ?? null;
    chestRef.current = humanoid?.getNormalizedBoneNode("chest") ?? null;
    headRef.current = humanoid?.getNormalizedBoneNode("head") ?? null;
    neckRef.current = humanoid?.getNormalizedBoneNode("neck") ?? null;
    spineRef.current = humanoid?.getNormalizedBoneNode("spine") ?? null;
    leftUpperArmRef.current = humanoid?.getNormalizedBoneNode("leftUpperArm") ?? null;
    rightUpperArmRef.current = humanoid?.getNormalizedBoneNode("rightUpperArm") ?? null;

    console.log("VRM Bone References:", {
      hips: hipsRef.current?.name,
      chest: chestRef.current?.name,
      head: headRef.current?.name,
      neck: neckRef.current?.name,
      spine: spineRef.current?.name,
      leftUpperArm: leftUpperArmRef.current?.name,
      rightUpperArm: rightUpperArmRef.current?.name,
    });

    // If bones not found, try alternative bone names
    if (!hipsRef.current || !leftUpperArmRef.current || !rightUpperArmRef.current) {
      console.warn("Some bones not found via getNormalizedBoneNode, searching scene...");
      vrm.scene.traverse((obj) => {
        const name = obj.name.toLowerCase();
        if (!hipsRef.current && (name.includes("hips") || name.includes("pelvis"))) {
          hipsRef.current = obj;
          console.log("Found hips via traverse:", obj.name);
        }
        if (!chestRef.current && (name.includes("chest") || name.includes("spine") || name.includes("upper"))) {
          chestRef.current = obj;
          console.log("Found chest via traverse:", obj.name);
        }
        if (!headRef.current && name.includes("head")) {
          headRef.current = obj;
          console.log("Found head via traverse:", obj.name);
        }
        if (!leftUpperArmRef.current && (name.includes("leftupperarm") || name.includes("left_upper_arm") || name.includes("l_upperarm") || (name.includes("arm") && name.includes("left") && name.includes("upper")))) {
          leftUpperArmRef.current = obj;
          console.log("Found leftUpperArm via traverse:", obj.name);
        }
        if (!rightUpperArmRef.current && (name.includes("rightupperarm") || name.includes("right_upper_arm") || name.includes("r_upperarm") || (name.includes("arm") && name.includes("right") && name.includes("upper")))) {
          rightUpperArmRef.current = obj;
          console.log("Found rightUpperArm via traverse:", obj.name);
        }
      });
    }

    // Log final arm bone status
    console.log("🦾 Arm bones after setup:", {
      leftUpperArm: leftUpperArmRef.current?.name || "NOT FOUND",
      rightUpperArm: rightUpperArmRef.current?.name || "NOT FOUND",
    });

    // Store base rotations for reference
    if (hipsRef.current) baseRotations.current.hips.copy(hipsRef.current.rotation);
    if (chestRef.current) baseRotations.current.chest.copy(chestRef.current.rotation);
    if (headRef.current) baseRotations.current.head.copy(headRef.current.rotation);
    if (leftUpperArmRef.current) baseRotations.current.leftUpperArm.copy(leftUpperArmRef.current.rotation);
    if (rightUpperArmRef.current) baseRotations.current.rightUpperArm.copy(rightUpperArmRef.current.rotation);

    // Initialize gesture manager
    const initGestures = async () => {
      if (!gestureManagerRef.current) {
        console.log("🎭 Creating GestureManager");
        gestureManagerRef.current = new GestureManager(vrm, {
          gestureChance: 0,
          minGestureInterval: 10,
          maxGestureInterval: 20,
          autoRandomGestures: false,
        });

        console.log("🎭 Loading all gestures...");
        await gestureManagerRef.current.loadAllGestures();
        console.log("🎭 All gestures loaded, attempting to play standing idle pose");

        // Set standing idle pose on startup - always playing unless overridden
        // Increased delay to ensure everything is ready
        setTimeout(() => {
          if (gestureManagerRef.current) {
            console.log("🧍 Playing standing idle pose now");
            const success = gestureManagerRef.current.playGesture("standing_idle", 0.5);
            console.log("🧍 Standing idle pose play result:", success);
          } else {
            console.warn("🧍 GestureManager was disposed before default pose could play");
          }
        }, 500); // Increased delay
      }
    };
    initGestures();

    return () => {
      group.remove(vrm.scene);
      // Cleanup gesture manager
      if (gestureManagerRef.current) {
        gestureManagerRef.current.dispose();
        gestureManagerRef.current = null;
      }
    };
  }, [vrm, url, gltf]);

  // Update emotion and trigger gestures
  useEffect(() => {
    if (!vrm) return;
    const intensity = emotion
      ? emotion.intensity === "high"
        ? 1
        : emotion.intensity === "medium"
        ? 0.6
        : 0.3
      : 0;

    const expressionManager = (vrm as VRM & { expressionManager?: { setValue: (name: string, weight: number) => void } })
      .expressionManager;
    if (expressionManager) {
      const names = Array.from(new Set(Object.values(emotionToExpression)));
      names.forEach((name) => expressionManager.setValue(name, 0));
      const expressionName = emotion ? emotionToExpression[emotion.emotion] ?? "neutral" : "neutral";
      expressionManager.setValue(expressionName, intensity);
    }

    // Update gesture manager with current emotion and play gesture if specified
    if (gestureManagerRef.current && emotion) {
      const emotionType = emotion.emotion as EmotionType;
      gestureManagerRef.current.setEmotion(emotionType);
      console.log("🎭 Updated gesture emotion:", emotionType);

      // Play specific gesture if one was specified by the backend
      if (emotion.gesture && emotion.gesture !== "none") {
        const gestureName = emotion.gesture as GestureName;
        console.log("🎬 Playing LLM-specified gesture:", gestureName);
        gestureManagerRef.current.playGesture(gestureName, 0.5);
      }
    }
  }, [emotion, vrm]);

  // Handle outfit visibility toggles
  useEffect(() => {
    if (!vrm) return;

    // Map outfit keys to mesh names
    const outfitMeshMap: Record<string, string> = {
      shirt: "Shirt",
      skirt: "Skirt",
      socks: "Knee_Socks",
      shoes: "Shoes",
    };

    vrm.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;

        // Handle outfit toggles
        for (const [key, meshName] of Object.entries(outfitMeshMap)) {
          if (mesh.name === meshName) {
            mesh.visible = outfitVisibility[key as keyof Omit<OutfitVisibility, 'colorVariant'>];
          }
        }
      }
    });

    // Handle VRM expressions for customization
    const expressionManager = vrm.expressionManager;
    if (expressionManager) {
      // ChangeColor - alternate color scheme
      expressionManager.setValue("ChangeColor", outfitVisibility.colorVariant ? 1 : 0);
      // Lingerie visibility (note: VRM expression is misspelled as "Lencerie" in the model)
      expressionManager.setValue("Lencerie", outfitVisibility.lingerie ? 1 : 0);
    }
  }, [outfitVisibility, vrm]);

  // Listen for pose test commands
  useEffect(() => {
    const cleanup = onPoseCommand((command: PoseCommand) => {
      if (!gestureManagerRef.current) {
        console.warn("GestureManager not ready for pose command");
        return;
      }

      if (command.type === "play" && command.pose) {
        // Use longer fade for smoother transitions to hold poses
        gestureManagerRef.current.playGesture(command.pose as GestureName, 0.8);
      } else if (command.type === "stop") {
        gestureManagerRef.current.returnToRest(0.8);
      }
    });

    return cleanup;
  }, []);

  // Listen for expression test commands
  useEffect(() => {
    if (!vrm) return;

    const cleanup = onExpressionCommand((command: ExpressionCommand) => {
      const expressionManager = vrm.expressionManager;
      if (!expressionManager) {
        console.warn("ExpressionManager not ready for expression command");
        return;
      }

      if (command.type === "set" && command.expression) {
        // Clear other expressions first, then set the new one
        ALL_EXPRESSIONS.forEach((expr) => expressionManager.setValue(expr, 0));
        expressionManager.setValue(command.expression, command.weight ?? 1.0);
        console.log(`😊 Set expression: ${command.expression} = ${command.weight ?? 1.0}`);
      } else if (command.type === "clear") {
        ALL_EXPRESSIONS.forEach((expr) => expressionManager.setValue(expr, 0));
        expressionManager.setValue("Neutral", 1.0);
        console.log("😊 Cleared all expressions, set Neutral");
      }
    });

    return cleanup;
  }, [vrm]);

  // Handle audio playback with lip sync
  useEffect(() => {
    if (!vrm || !audioUrl) {
      return;
    }

    // If this is the same audio, skip
    if (currentAudioRef.current === audioUrl) {
      console.log("⏭️ Already playing this audio, skipping");
      return;
    }

    // CRITICAL: Stop current audio immediately when new message arrives
    // This allows quick responses to prioritize over longer previous responses
    if (lipSyncRef.current && currentAudioRef.current) {
      console.log("⏹️ Stopping current audio to prioritize new message");
      lipSyncRef.current.stop();
    }

    console.log("▶️ Setting up new audio:", audioUrl);

    // CRITICAL FOR MOBILE: Setup and play must be called synchronously
    // to preserve the user interaction context required by mobile browsers
    try {
      // Create or reuse LipSyncManager
      if (!lipSyncRef.current) {
        console.log("📦 Creating new LipSyncManager");
        lipSyncRef.current = new LipSyncManager(vrm, {
          smoothingFactor: 0.2,
          amplitudeScale: 12.0, // Increased for more visible mouth movement
          amplitudeThreshold: 0.0005, // Lower threshold to catch quieter audio (like OpenAI TTS fallback)
        });
      }

      console.log("🔊 Loading audio from:", audioUrl);
      // Setup audio synchronously (no await)
      lipSyncRef.current.setupAudio(audioUrl);
      console.log("✅ Audio setup complete");

      // Set lip sync timing data if available (for accurate word sync)
      lipSyncRef.current.setLipSyncData(lipSync ?? null);

      // Call play() synchronously to preserve user interaction context for mobile
      lipSyncRef.current.play();
      console.log("✓ Playing audio with lip sync:", audioUrl);

      // Only mark as current after successful setup (prevents retry blocking if setup fails)
      currentAudioRef.current = audioUrl;
    } catch (error) {
      console.error("❌ Failed to play audio:", error);
      // Don't set currentAudioRef so we can retry on next update
    }

    // No cleanup function needed - setupAudio() handles cleanup internally
  }, [audioUrl, lipSync, vrm]);

  useFrame((_, delta) => {
    if (!vrm) return;

    // Update VRM system
    vrm.update(delta);
    const expressionManager = (vrm as VRM & { expressionManager?: { update?: (delta: number) => void } }).expressionManager;
    expressionManager?.update?.(delta);

    // Update lip sync if audio is playing
    if (lipSyncRef.current) {
      lipSyncRef.current.update();
    }

    // Update gesture manager animations
    if (gestureManagerRef.current) {
      gestureManagerRef.current.update(delta);
    }

    const anim = animationState.current;
    const cfg = ANIMATION_CONFIG;
    const randomInRange = (min: number, max: number) => min + Math.random() * (max - min);

    // Procedural blinking animation
    anim.eyes.timer += delta;
    if (anim.eyes.timer > anim.eyes.nextBlink) {
      anim.eyes.timer = 0;
      anim.eyes.nextBlink = randomInRange(cfg.blink.minInterval, cfg.blink.maxInterval);
    }

    const blinkPhase = anim.eyes.timer < cfg.blink.duration ? delta : -delta;
    anim.eyes.blinkAmount += blinkPhase * cfg.blink.speed;
    anim.eyes.blinkAmount = Math.max(0, Math.min(1, anim.eyes.blinkAmount));

    if (expressionManager) {
      expressionManager.setValue('Blink', anim.eyes.blinkAmount);
      expressionManager.setValue('Neutral', 1.0);
    }

    // Track current gesture for animation state publishing
    const currentGesture = gestureManagerRef.current?.getCurrentGesture();

    // Publish animation state changes to global state
    const gestureToPublish = currentGesture ?? null;
    if (gestureToPublish !== lastPublishedGestureRef.current) {
      lastPublishedGestureRef.current = gestureToPublish;
      setAnimationState(gestureToPublish, !!gestureToPublish);
    }

    // Check if avatar is currently talking (audio playing)
    const isTalking = lipSyncRef.current?.isPlaying() ?? false;

    // Get animation params based on talking state (more dynamic when speaking)
    const headFreq = isTalking ? cfg.head.talkFrequency : cfg.head.idleFrequency;
    const headSmooth = isTalking ? cfg.head.talkSmoothing : cfg.head.idleSmoothing;
    const torsoFreq = isTalking ? cfg.torso.talkFrequency : cfg.torso.idleFrequency;
    const torsoSmooth = isTalking ? cfg.torso.talkSmoothing : cfg.torso.idleSmoothing;

    // Procedural head movement for natural idle behavior
    anim.head.timer += delta;
    if (anim.head.timer > headFreq) {
      anim.head.targetRotation.x = randomInRange(-cfg.head.nodRange, cfg.head.nodRange);
      anim.head.targetRotation.y = randomInRange(-cfg.head.turnRange, cfg.head.turnRange);
      anim.head.targetRotation.z = randomInRange(-cfg.head.tiltRange, cfg.head.tiltRange);
      anim.head.timer = 0;
    }

    // Smooth interpolation toward target
    anim.head.currentRotation.x += (anim.head.targetRotation.x - anim.head.currentRotation.x) * headSmooth;
    anim.head.currentRotation.y += (anim.head.targetRotation.y - anim.head.currentRotation.y) * headSmooth;
    anim.head.currentRotation.z += (anim.head.targetRotation.z - anim.head.currentRotation.z) * headSmooth;

    if (neckRef.current) {
      neckRef.current.rotation.set(
        anim.head.currentRotation.x,
        anim.head.currentRotation.y,
        anim.head.currentRotation.z
      );
    }

    // Procedural torso sway for breathing effect
    anim.torso.timer += delta;
    if (anim.torso.timer > torsoFreq) {
      anim.torso.targetRotation.x = randomInRange(-cfg.torso.swayRange, cfg.torso.swayRange);
      anim.torso.timer = 0;
    }

    anim.torso.currentRotation.x += (anim.torso.targetRotation.x - anim.torso.currentRotation.x) * torsoSmooth;

    if (spineRef.current) {
      spineRef.current.rotation.x = anim.torso.currentRotation.x;
    }
  });

  if (!vrm) {
    return null;
  }

  return <group ref={groupRef} />;
}
