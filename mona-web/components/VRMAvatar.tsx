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
import { onPoseCommand, onExpressionCommand, onSpeakCommand, type PoseCommand, type ExpressionCommand, type SpeakCommand } from "@/lib/poseCommands";
import { setAnimationState } from "@/lib/animationState";
import { AvatarStateMachine, type AvatarState } from "@/lib/animation/avatarStateMachine";

// Old ANIMATION_CONFIG removed — replaced by AvatarStateMachine

// Per-avatar configuration for different VRM models
const AVATAR_CONFIGS: Record<string, { scale: number; position: [number, number, number]; rotateY: number }> = {
  "Moe.vrm": { scale: 0.85, position: [0, 0.10, 0], rotateY: Math.PI },
  "/avatars/Moe.vrm": { scale: 0.85, position: [0, 0.10, 0], rotateY: Math.PI },
  "Mona1.vrm": { scale: 0.95, position: [0, 0.10, 0], rotateY: 0 },
  "/avatars/Mona1.vrm": { scale: 0.95, position: [0, 0.10, 0], rotateY: 0 },
  "Tora.vrm": { scale: 0.65, position: [0, 0.10, 0], rotateY: Math.PI },
  "/avatars/Tora.vrm": { scale: 0.65, position: [0, 0.10, 0], rotateY: Math.PI },
  "sakura.vrm": { scale: 0.70, position: [0, 0.10, 0], rotateY: Math.PI },
  "/avatars/sakura.vrm": { scale: 0.70, position: [0, 0.10, 0], rotateY: Math.PI },
  "Cantarella.vrm": { scale: 0.70, position: [0, 0.20, 0], rotateY: Math.PI },
  "/avatars/Cantarella.vrm": { scale: 0.70, position: [0, 0.20, 0], rotateY: Math.PI },
  "Eimi.vrm": { scale: 0.70, position: [0, 0.50, 0], rotateY: Math.PI },
  "/avatars/Eimi.vrm": { scale: 0.70, position: [0, 0.50, 0], rotateY: Math.PI },
};

// Default config for unknown avatars
const DEFAULT_AVATAR_CONFIG = { scale: 0.95, position: [0, 0.10, 0] as [number, number, number], rotateY: 0 };

// Map backend emotions to Moe.vrm expression names
const emotionToExpression: Record<string, string> = {
  // Positive emotions
  happy: "happy",
  excited: "happy",
  content: "relaxed",
  affectionate: "happy",
  playful: "happy",

  // Neutral/Mixed emotions
  curious: "neutral",
  surprised: "happy",
  embarrassed: "Special",
  confused: "neutral",
  bored: "relaxed",
  neutral: "neutral",

  // Negative emotions
  concerned: "sad",
  sad: "sad",
  annoyed: "angry",
  angry: "angry",
  frustrated: "angry",
};

// All available Moe.vrm expressions for testing
export const ALL_EXPRESSIONS = [
  "neutral", "happy", "angry", "sad", "relaxed",
  "blink", "blinkLeft", "blinkRight",
  "lookUp", "lookDown", "lookLeft", "lookRight",
  "aa", "ih", "ou", "ee", "oh",
  "Special", "CheekPuff",
] as const;

// Outfit visibility configuration
export interface OutfitVisibility {
  shirt: boolean;
  skirt: boolean;
  socks: boolean;
  shoes: boolean;
  colorVariant: boolean;
  lingerie: boolean;
}

// Settings lip sync mode type (from SettingsModal)
export type SettingsLipSyncMode = "textbased" | "realtime" | "formant";

interface VRMAvatarProps {
  url: string;
  emotion: EmotionData | null;
  audioUrl?: string | null;
  lipSync?: LipSyncCue[];
  outfitVisibility?: OutfitVisibility;
  onAudioEnd?: () => void;
  lipSyncMode?: SettingsLipSyncMode;
  avatarState?: AvatarState;
}

const DEFAULT_OUTFIT: OutfitVisibility = {
  shirt: true,
  skirt: true,
  socks: true,
  shoes: true,
  colorVariant: false,
  lingerie: false,
};

// Get max mouth open value based on avatar
function getMaxMouthOpen(avatarUrl: string): number {
  if (avatarUrl.includes("Moe")) {
    return 0.88;
  }
  if (avatarUrl.includes("Cantarella") || avatarUrl.includes("Eimi")) {
    return 0.88;
  }
  return 0.78;
}

export default function VRMAvatar({ url, emotion, audioUrl, lipSync, outfitVisibility = DEFAULT_OUTFIT, onAudioEnd, lipSyncMode = "textbased", avatarState = "idle" }: VRMAvatarProps) {
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
  const testExpressionRef = useRef<string | null>(null);
  const emotionExpressionRef = useRef<string | null>(null);
  const prevExpressionRef = useRef<string | null>(null);
  const stateMachineRef = useRef<AvatarStateMachine>(new AvatarStateMachine());
  const prevAvatarStateRef = useRef<AvatarState>("idle");

  const baseRotations = useRef({
    hips: new THREE.Euler(),
    chest: new THREE.Euler(),
    head: new THREE.Euler(),
    leftUpperArm: new THREE.Euler(),
    rightUpperArm: new THREE.Euler(),
  });

  // Old animationState ref removed — replaced by AvatarStateMachine
  const gltf = useLoader(
    GLTFLoader,
    url,
    (loader) => loader.register((parser) => new VRMLoaderPlugin(parser))
  );

  const vrm = useMemo(() => gltf.userData.vrm as VRM | undefined, [gltf]);

  useEffect(() => {
    if (!vrm || !groupRef.current) return;
    const group = groupRef.current;

    // VRMUtils performance optimizations
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

    // Setup meshes for shadows
    vrm.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.material && "toneMapped" in mesh.material) {
          (mesh.material as THREE.Material & { toneMapped?: boolean }).toneMapped = true;
        }
      }
    });

    const humanoid = vrm.humanoid;

    // Get all bones we need
    hipsRef.current = humanoid?.getNormalizedBoneNode("hips") ?? null;
    chestRef.current = humanoid?.getNormalizedBoneNode("chest") ?? null;
    headRef.current = humanoid?.getNormalizedBoneNode("head") ?? null;
    neckRef.current = humanoid?.getNormalizedBoneNode("neck") ?? null;
    spineRef.current = humanoid?.getNormalizedBoneNode("spine") ?? null;
    leftUpperArmRef.current = humanoid?.getNormalizedBoneNode("leftUpperArm") ?? null;
    rightUpperArmRef.current = humanoid?.getNormalizedBoneNode("rightUpperArm") ?? null;

    // If bones not found, try alternative bone names
    if (!hipsRef.current || !leftUpperArmRef.current || !rightUpperArmRef.current) {
      vrm.scene.traverse((obj) => {
        const name = obj.name.toLowerCase();
        if (!hipsRef.current && (name.includes("hips") || name.includes("pelvis"))) {
          hipsRef.current = obj;
        }
        if (!chestRef.current && (name.includes("chest") || name.includes("spine") || name.includes("upper"))) {
          chestRef.current = obj;
        }
        if (!headRef.current && name.includes("head")) {
          headRef.current = obj;
        }
        if (!leftUpperArmRef.current && (name.includes("leftupperarm") || name.includes("left_upper_arm") || name.includes("l_upperarm") || (name.includes("arm") && name.includes("left") && name.includes("upper")))) {
          leftUpperArmRef.current = obj;
        }
        if (!rightUpperArmRef.current && (name.includes("rightupperarm") || name.includes("right_upper_arm") || name.includes("r_upperarm") || (name.includes("arm") && name.includes("right") && name.includes("upper")))) {
          rightUpperArmRef.current = obj;
        }
      });
    }

    // Store base rotations for reference
    if (hipsRef.current) baseRotations.current.hips.copy(hipsRef.current.rotation);
    if (chestRef.current) baseRotations.current.chest.copy(chestRef.current.rotation);
    if (headRef.current) baseRotations.current.head.copy(headRef.current.rotation);
    if (leftUpperArmRef.current) baseRotations.current.leftUpperArm.copy(leftUpperArmRef.current.rotation);
    if (rightUpperArmRef.current) baseRotations.current.rightUpperArm.copy(rightUpperArmRef.current.rotation);

    // Initialize gesture manager
    const initGestures = async () => {
      if (!gestureManagerRef.current) {
        gestureManagerRef.current = new GestureManager(vrm, {
          gestureChance: 0,
          minGestureInterval: 10,
          maxGestureInterval: 20,
          autoRandomGestures: false,
        });

        await gestureManagerRef.current.loadAllGestures();

        // Set idle pose on startup — using temp_idle for testing (switch to "standing_idle" to revert)
        setTimeout(() => {
          if (gestureManagerRef.current) {
            gestureManagerRef.current.playGesture("temp_idle", 0.5);
          }
        }, 500);
      }
    };
    initGestures();

    return () => {
      group.remove(vrm.scene);
      if (gestureManagerRef.current) {
        gestureManagerRef.current.dispose();
        gestureManagerRef.current = null;
      }
    };
  }, [vrm, url, gltf]);

  // Update emotion and trigger gestures
  useEffect(() => {
    if (!vrm || !emotion) return;

    // Skip emotion-based expression if a test expression is active
    if (testExpressionRef.current) {
      if (gestureManagerRef.current) {
        const emotionType = emotion.emotion as EmotionType;
        gestureManagerRef.current.setEmotion(emotionType);
      }
      return;
    }

    const intensity = emotion.intensity === "high"
      ? 1
      : emotion.intensity === "medium"
      ? 0.6
      : 0.3;

    const expressionManager = (vrm as VRM & { expressionManager?: { setValue: (name: string, weight: number) => void } })
      .expressionManager;
    if (expressionManager) {
      const names = Array.from(new Set(Object.values(emotionToExpression)));
      names.forEach((name) => expressionManager.setValue(name, 0));
      const expressionName = emotionToExpression[emotion.emotion] ?? "neutral";
      expressionManager.setValue(expressionName, intensity);
      emotionExpressionRef.current = expressionName;
    }

    // Update gesture manager with current emotion and play gesture if specified
    if (gestureManagerRef.current) {
      const emotionType = emotion.emotion as EmotionType;
      gestureManagerRef.current.setEmotion(emotionType);

      if (emotion.gesture && emotion.gesture !== "none") {
        const gestureName = emotion.gesture as GestureName;
        gestureManagerRef.current.playGesture(gestureName, 0.5);
      }
    }
  }, [emotion, vrm]);

  // Handle outfit visibility toggles
  useEffect(() => {
    if (!vrm) return;

    const outfitMeshMap: Record<string, string> = {
      shirt: "Shirt",
      skirt: "Skirt",
      socks: "Knee_Socks",
      shoes: "Shoes",
    };

    vrm.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;

        for (const [key, meshName] of Object.entries(outfitMeshMap)) {
          if (mesh.name === meshName) {
            mesh.visible = outfitVisibility[key as keyof Omit<OutfitVisibility, 'colorVariant'>];
          }
        }
      }
    });

    const expressionManager = vrm.expressionManager;
    if (expressionManager) {
      expressionManager.setValue("ChangeColor", outfitVisibility.colorVariant ? 1 : 0);
      expressionManager.setValue("Lencerie", outfitVisibility.lingerie ? 1 : 0);
    }
  }, [outfitVisibility, vrm]);

  // Listen for pose test commands
  useEffect(() => {
    const cleanup = onPoseCommand((command: PoseCommand) => {
      if (!gestureManagerRef.current) {
        return;
      }

      if (command.type === "play" && command.pose) {
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
        return;
      }

      if (command.type === "set" && command.expression) {
        ALL_EXPRESSIONS.forEach((expr) => expressionManager.setValue(expr, 0));
        expressionManager.setValue(command.expression, command.weight ?? 1.0);
        testExpressionRef.current = command.expression;
      } else if (command.type === "clear") {
        ALL_EXPRESSIONS.forEach((expr) => expressionManager.setValue(expr, 0));
        expressionManager.setValue("neutral", 1.0);
        testExpressionRef.current = null;
        emotionExpressionRef.current = null;
      }
    });

    return cleanup;
  }, [vrm]);

  // Listen for test speak commands
  useEffect(() => {
    if (!vrm) return;

    const cleanup = onSpeakCommand((command: SpeakCommand) => {
      if (!lipSyncRef.current) {
        const maxMouthOpen = getMaxMouthOpen(url);
        lipSyncRef.current = new LipSyncManager(vrm, {
          smoothingFactor: 0.2,
          amplitudeScale: 12.0,
          amplitudeThreshold: 0.0005,
          maxMouthOpen,
          mode: lipSyncMode === "formant" ? "formant" : undefined,
        });
      } else if (lipSyncMode === "formant") {
        // Update mode if it changed
        lipSyncRef.current.updateConfig({ mode: "formant" });
      }

      lipSyncRef.current.stop();

      if (command.audioUrl) {
        try {
          lipSyncRef.current.setupAudio(command.audioUrl);
          lipSyncRef.current.setLipSyncData(command.lipSync);
          lipSyncRef.current.play();
        } catch (error) {
          lipSyncRef.current.setLipSyncData(command.lipSync);
        }
      } else {
        lipSyncRef.current.setLipSyncData(command.lipSync);
      }
    });

    return cleanup;
  }, [vrm, url, lipSyncMode]);

  // Handle audio playback with lip sync
  useEffect(() => {
    if (!vrm || !audioUrl) {
      return;
    }

    if (currentAudioRef.current === audioUrl) {
      return;
    }

    if (lipSyncRef.current && currentAudioRef.current) {
      lipSyncRef.current.stop();
    }

    try {
      if (!lipSyncRef.current) {
        const maxMouthOpen = getMaxMouthOpen(url);
        lipSyncRef.current = new LipSyncManager(vrm, {
          smoothingFactor: 0.2,
          amplitudeScale: 12.0,
          amplitudeThreshold: 0.0005,
          maxMouthOpen,
          mode: lipSyncMode === "formant" ? "formant" : undefined,
        });
      } else {
        // Update mode if it changed
        lipSyncRef.current.updateConfig({
          mode: lipSyncMode === "formant" ? "formant" : undefined
        });
      }

      lipSyncRef.current.setupAudio(audioUrl);
      lipSyncRef.current.setLipSyncData(lipSync ?? null);
      // Set callback for when audio ends (for queued playback)
      lipSyncRef.current.setOnAudioEnded(onAudioEnd ?? null);
      lipSyncRef.current.play();
      currentAudioRef.current = audioUrl;
    } catch (error) {
      // Silently handle errors
    }
  }, [audioUrl, lipSync, vrm, onAudioEnd, lipSyncMode, url]);

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

    // Auto-detect talking from lip sync when no explicit state is given
    const isTalking = lipSyncRef.current?.isPlaying() ?? false;
    const effectiveState: AvatarState = avatarState !== "idle" ? avatarState : (isTalking ? "talking" : "idle");

    // Sync effective state → state machine
    if (effectiveState !== prevAvatarStateRef.current) {
      stateMachineRef.current.setState(effectiveState);
      prevAvatarStateRef.current = effectiveState;

      // Switch body FBX animation based on state (VRM only)
      if (gestureManagerRef.current) {
        if (effectiveState === "talking") {
          gestureManagerRef.current.playGesture("talking_idle", 0.5);
        } else if (effectiveState === "thinking") {
          gestureManagerRef.current.playGesture("thinking", 0.8);
        } else {
          // idle / listening → return to default idle
          gestureManagerRef.current.returnToIdle(0.5);
        }
      }
    }

    // Run the physics-based state machine
    const sm = stateMachineRef.current.update(delta);

    // Apply blinking from state machine
    if (expressionManager) {
      expressionManager.setValue('blink', sm.blinkAmount);

      const activeExpression = testExpressionRef.current ?? emotionExpressionRef.current;

      if (prevExpressionRef.current && prevExpressionRef.current !== activeExpression) {
        expressionManager.setValue(prevExpressionRef.current, 0);
      }

      if (activeExpression) {
        expressionManager.setValue(activeExpression, 1.0);
        prevExpressionRef.current = activeExpression;
      }
    }

    // Track current gesture for animation state publishing
    const currentGesture = gestureManagerRef.current?.getCurrentGesture();
    const gestureToPublish = currentGesture ?? null;
    if (gestureToPublish !== lastPublishedGestureRef.current) {
      lastPublishedGestureRef.current = gestureToPublish;
      setAnimationState(gestureToPublish, !!gestureToPublish);
    }

    // Apply state machine head rotation to neck bone
    if (neckRef.current) {
      neckRef.current.rotation.set(sm.headX, sm.headY, sm.headZ);
    }

    // Apply state machine body sway to spine
    if (spineRef.current) {
      spineRef.current.rotation.x = sm.bodyX;
    }
  });

  if (!vrm) {
    return null;
  }

  return <group ref={groupRef} />;
}
