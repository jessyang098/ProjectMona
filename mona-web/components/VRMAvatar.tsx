"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin } from "@pixiv/three-vrm";
import type { EmotionData } from "@/types/chat";
import * as THREE from "three";
import { LipSyncManager } from "@/lib/animation";
import { GestureManager, type EmotionType } from "@/lib/animation/gestureManager";

// Procedural animation configuration
const ANIMATION_CONFIG = {
  // Blinking behavior
  blink: {
    minInterval: 0.5,
    maxInterval: 3.0,
    speed: 8.0,
    duration: 0.1,
  },
  // Head movement ranges and timing
  head: {
    nodRange: 0.2,
    turnRange: 0.13,
    tiltRange: 0.15,
    changeFrequency: 1.8,
    smoothingFactor: 0.02,
  },
  // Torso movement for breathing effect
  torso: {
    swayRange: 0.1,
    changeFrequency: 2.8,
    smoothingFactor: 0.01,
  },
  // Arm positions to fix T-pose
  arms: {
    leftRotationZ: -1.2,
    rightRotationZ: 1.2,
  },
} as const;

const emotionToExpression: Record<string, string> = {
  // Positive emotions
  happy: "happy",
  excited: "happy",
  content: "relaxed",
  affectionate: "relaxed",
  playful: "happy",

  // Neutral/Mixed emotions
  curious: "surprised",
  surprised: "surprised",
  embarrassed: "shy",
  confused: "surprised",
  bored: "neutral",
  neutral: "neutral",

  // Negative emotions
  concerned: "sad",
  sad: "sad",
  annoyed: "sad",      // VRM may not have 'angry', use 'sad' with furrowed brow
  angry: "sad",        // VRM may not have 'angry', use 'sad' with furrowed brow
  frustrated: "sad",
};

interface VRMAvatarProps {
  url: string;
  emotion: EmotionData | null;
  audioUrl?: string | null;
}

export default function VRMAvatar({ url, emotion, audioUrl }: VRMAvatarProps) {
  console.log("🎭 VRMAvatar rendered with audioUrl:", audioUrl);

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
    group.add(vrm.scene);
    vrm.scene.rotation.y = 0;
    vrm.scene.scale.setScalar(1.05);
    vrm.scene.position.set(0, 0, 0);
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
    if (!hipsRef.current) {
      console.warn("Hips bone not found via getNormalizedBoneNode, searching scene...");
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
      });
    }

    // Store base rotations
    if (hipsRef.current) baseRotations.current.hips.copy(hipsRef.current.rotation);
    if (chestRef.current) baseRotations.current.chest.copy(chestRef.current.rotation);
    if (headRef.current) baseRotations.current.head.copy(headRef.current.rotation);

    // Fix T-pose by rotating arms to resting position
    if (leftUpperArmRef.current) {
      baseRotations.current.leftUpperArm.copy(leftUpperArmRef.current.rotation);
      leftUpperArmRef.current.rotation.z = ANIMATION_CONFIG.arms.leftRotationZ;
    }
    if (rightUpperArmRef.current) {
      baseRotations.current.rightUpperArm.copy(rightUpperArmRef.current.rotation);
      rightUpperArmRef.current.rotation.z = ANIMATION_CONFIG.arms.rightRotationZ;
    }

    // Initialize gesture manager
    const initGestures = async () => {
      if (!gestureManagerRef.current) {
        console.log("🎭 Creating GestureManager");
        gestureManagerRef.current = new GestureManager(vrm, {
          gestureChance: 0.4,
          minGestureInterval: 10,
          maxGestureInterval: 20,
          autoRandomGestures: true,
        });
        await gestureManagerRef.current.loadAllGestures();

        // Play greeting wave animation on startup
        console.log("👋 Playing startup greeting wave");
        setTimeout(() => {
          gestureManagerRef.current?.playGesture("wave", 0.5);
        }, 500); // Small delay to let VRM fully load
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
  }, [vrm]);

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

    // Update gesture manager with current emotion
    if (gestureManagerRef.current && emotion) {
      const emotionType = emotion.emotion as EmotionType;
      gestureManagerRef.current.setEmotion(emotionType);
      console.log("🎭 Updated gesture emotion:", emotionType);
    }
  }, [emotion, vrm]);

  // Handle audio playback with lip sync
  useEffect(() => {
    if (!vrm || !audioUrl) {
      return;
    }

    // Skip if already playing this audio
    if (currentAudioRef.current === audioUrl) {
      console.log("⏭️ Already playing this audio, skipping");
      return;
    }

    console.log("▶️ Setting up new audio:", audioUrl);

    // CRITICAL FOR MOBILE: Setup and play must be called synchronously
    // to preserve the user interaction context required by mobile browsers
    try {
      // Create or reuse LipSyncManager
      if (!lipSyncRef.current) {
        console.log("📦 Creating new LipSyncManager");
        lipSyncRef.current = new LipSyncManager(vrm, {
          smoothingFactor: 0.3,
          amplitudeScale: 1.0, // Match Riko's subtle mouth movement
          amplitudeThreshold: 0.001, // Lower threshold to trigger more easily
        });
      }

      console.log("🔊 Loading audio from:", audioUrl);
      // Setup audio synchronously (no await)
      lipSyncRef.current.setupAudio(audioUrl);
      console.log("✅ Audio setup complete");

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
  }, [audioUrl, vrm]);

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
      expressionManager.setValue('blink', anim.eyes.blinkAmount);
      expressionManager.setValue('neutral', 1.0);
    }

    // Constrain arms to stay near resting position (limit range during gestures)
    if (leftUpperArmRef.current) {
      const currentZ = leftUpperArmRef.current.rotation.z;
      const restZ = cfg.arms.leftRotationZ;
      const maxDeviation = 0.2; // Maximum radians arms can deviate from rest pose (about 11 degrees)

      // Clamp rotation to stay within allowed range
      const minZ = restZ - maxDeviation;
      const maxZ = restZ + maxDeviation;
      leftUpperArmRef.current.rotation.z = Math.max(minZ, Math.min(maxZ, currentZ));
    }
    if (rightUpperArmRef.current) {
      const currentZ = rightUpperArmRef.current.rotation.z;
      const restZ = cfg.arms.rightRotationZ;
      const maxDeviation = 0.2; // Maximum radians arms can deviate from rest pose (about 11 degrees)

      // Clamp rotation to stay within allowed range
      const minZ = restZ - maxDeviation;
      const maxZ = restZ + maxDeviation;
      rightUpperArmRef.current.rotation.z = Math.max(minZ, Math.min(maxZ, currentZ));
    }

    // Procedural head movement for natural idle behavior
    anim.head.timer += delta;
    if (anim.head.timer > cfg.head.changeFrequency) {
      anim.head.targetRotation.x = randomInRange(-cfg.head.nodRange, cfg.head.nodRange);
      anim.head.targetRotation.y = randomInRange(-cfg.head.turnRange, cfg.head.turnRange);
      anim.head.targetRotation.z = randomInRange(-cfg.head.tiltRange, cfg.head.tiltRange);
      anim.head.timer = 0;
    }

    // Smooth interpolation toward target
    anim.head.currentRotation.x += (anim.head.targetRotation.x - anim.head.currentRotation.x) * cfg.head.smoothingFactor;
    anim.head.currentRotation.y += (anim.head.targetRotation.y - anim.head.currentRotation.y) * cfg.head.smoothingFactor;
    anim.head.currentRotation.z += (anim.head.targetRotation.z - anim.head.currentRotation.z) * cfg.head.smoothingFactor;

    if (neckRef.current) {
      neckRef.current.rotation.set(
        anim.head.currentRotation.x,
        anim.head.currentRotation.y,
        anim.head.currentRotation.z
      );
    }

    // Procedural torso sway for breathing effect
    anim.torso.timer += delta;
    if (anim.torso.timer > cfg.torso.changeFrequency) {
      anim.torso.targetRotation.x = randomInRange(-cfg.torso.swayRange, cfg.torso.swayRange);
      anim.torso.timer = 0;
    }

    anim.torso.currentRotation.x += (anim.torso.targetRotation.x - anim.torso.currentRotation.x) * cfg.torso.smoothingFactor;

    if (spineRef.current) {
      spineRef.current.rotation.x = anim.torso.currentRotation.x;
    }
  });

  if (!vrm) {
    return null;
  }

  return <group ref={groupRef} />;
}
