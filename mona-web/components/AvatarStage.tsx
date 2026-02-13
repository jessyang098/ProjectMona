"use client";

import { Suspense, useMemo, useRef, useEffect, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import dynamic from "next/dynamic";
import type { EmotionData, LipSyncCue } from "@/types/chat";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { OutfitVisibility } from "./VRMAvatar";
import type { AvatarState } from "@/lib/animation/avatarStateMachine";
export type { OutfitVisibility, AvatarState };

const VRMAvatar = dynamic(() => import("./VRMAvatar"), { ssr: false });
const Live2DAvatar = dynamic(() => import("./Live2DAvatar"), { ssr: false });

// Detect if a URL points to a Live2D model (folder with .model3.json)
function isLive2DModel(url: string): boolean {
  // Live2D models are referenced by their .model3.json file
  return url.includes(".model3.json");
}

// Loading indicator component for 3D canvas
function LoadingIndicator() {
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
        <p className="text-sm text-gray-600">Your companion is loading...</p>
      </div>
    </Html>
  );
}

const emotionPalette: Record<string, { primary: string; accent: string }> = {
  // Positive emotions
  happy: { primary: "#ff9de6", accent: "#ffd1f7" },
  excited: { primary: "#ffd166", accent: "#ffe29a" },
  content: { primary: "#9be7ff", accent: "#d5f4ff" },
  affectionate: { primary: "#f472b6", accent: "#fbcfe8" },
  playful: { primary: "#fbbf24", accent: "#fde68a" },

  // Neutral/Mixed emotions
  curious: { primary: "#a5b4ff", accent: "#d8deff" },
  surprised: { primary: "#ffb7b2", accent: "#ffdada" },
  embarrassed: { primary: "#f9a8d4", accent: "#fbcfe8" },
  confused: { primary: "#c7d2fe", accent: "#e0e7ff" },
  bored: { primary: "#d1d5db", accent: "#e5e7eb" },
  neutral: { primary: "#c4c4ff", accent: "#e4e4ff" },

  // Negative emotions
  concerned: { primary: "#fca5a5", accent: "#fdd5d5" },
  sad: { primary: "#9ca3af", accent: "#cbd5f5" },
  annoyed: { primary: "#fcd34d", accent: "#fef3c7" },
  angry: { primary: "#ef4444", accent: "#fca5a5" },
  frustrated: { primary: "#f59e0b", accent: "#fcd34d" },
};

// Available avatar options
export const AVATAR_OPTIONS = [
  { id: "vena", label: "Vena", url: "/avatars/Vena/Vena - Kimono Outfit.model3.json", type: "live2d" as const },
  { id: "moe", label: "Moe", url: "/avatars/Moe.vrm", type: "vrm" as const },
  { id: "mona1", label: "Mona", url: "/avatars/Mona1.vrm", type: "vrm" as const },
  { id: "bear-pajama", label: "Bear Pajama", url: "/avatars/bear Pajama V1.1/bear Pajama V1.1.model3.json", type: "live2d" as const },
] as const;

export type AvatarId = typeof AVATAR_OPTIONS[number]["id"];

// Settings lip sync mode type (from SettingsModal)
export type SettingsLipSyncMode = "textbased" | "realtime" | "formant";

interface AvatarStageProps {
  emotion: EmotionData | null;
  audioUrl?: string;
  lipSync?: LipSyncCue[];
  viewMode?: "portrait" | "full";
  outfitVisibility?: OutfitVisibility;
  avatarUrl?: string;
  onAudioEnd?: () => void;
  lipSyncMode?: SettingsLipSyncMode;
  isDarkMode?: boolean;
  affectionLevel?: string;
  onTap?: () => void;
  avatarState?: AvatarState;
}

// FOV offset based on affection level (closer as affection grows)
const AFFECTION_FOV_OFFSET: Record<string, number> = {
  distant: 0,
  warming_up: -1,
  close: -3,
  devoted: -5,
};

// Camera presets for different view modes
const VIEW_PRESETS = {
  // Desktop presets
  portrait: {
    position: new THREE.Vector3(0, 0.9, 1.8),
    target: new THREE.Vector3(0, 1.0, 0),
    fov: 26, // Narrower FOV = more zoomed in, larger character
  },
  full: {
    position: new THREE.Vector3(0, 0.85, 1.8),
    target: new THREE.Vector3(0, 0.75, 0),
    fov: 42, // Default wider FOV
  },
  // Mobile presets - adjusted for smaller screens
  mobilePortrait: {
    position: new THREE.Vector3(0, 1.0, 2.0),
    target: new THREE.Vector3(0, 1.0, 0),
    fov: 28, // Slightly wider than desktop portrait for mobile
  },
  mobileFull: {
    position: new THREE.Vector3(0, 0.794, 2.432),
    target: new THREE.Vector3(0, 0.659, 0),
    fov: 42,
  },
};

// Detect if on mobile device
const isMobile = () => {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || window.innerWidth < 768;
};

// Get the effective preset key based on device and view mode
const getPresetKey = (viewMode: "portrait" | "full"): keyof typeof VIEW_PRESETS => {
  if (isMobile()) {
    return viewMode === "portrait" ? "mobilePortrait" : "mobileFull";
  }
  return viewMode;
};

// Component to handle camera transitions
function CameraController({ viewMode, affectionLevel = "distant" }: { viewMode: "portrait" | "full"; affectionLevel?: string }) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // Get the appropriate preset based on device and view mode
  const presetKey = getPresetKey(viewMode);
  const fovOffset = AFFECTION_FOV_OFFSET[affectionLevel] ?? 0;

  useEffect(() => {
    const preset = VIEW_PRESETS[presetKey];

    // Animate camera position and FOV
    const startPos = camera.position.clone();
    const endPos = preset.position;
    const startFov = (camera as THREE.PerspectiveCamera).fov;
    const endFov = preset.fov + fovOffset;
    const startTime = performance.now();
    const duration = 500; // ms

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      camera.position.lerpVectors(startPos, endPos, eased);

      // Animate FOV for zoom effect
      const perspCamera = camera as THREE.PerspectiveCamera;
      perspCamera.fov = startFov + (endFov - startFov) * eased;
      perspCamera.updateProjectionMatrix();

      if (controlsRef.current) {
        controlsRef.current.target.lerp(preset.target, eased);
        controlsRef.current.update();
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [presetKey, camera, fovOffset]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      target={VIEW_PRESETS[presetKey].target.toArray() as [number, number, number]}
      minDistance={0.8}
      maxDistance={5}
      minPolarAngle={Math.PI / 4}
      maxPolarAngle={Math.PI / 1.5}
      enableDamping={true}
      dampingFactor={0.05}
    />
  );
}

// Loading indicator for Live2D canvas
function Live2DLoadingIndicator() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
        <p className="text-sm text-gray-600">Your companion is loading...</p>
      </div>
    </div>
  );
}

export default function AvatarStage({ emotion, audioUrl, lipSync, viewMode = "full", outfitVisibility, avatarUrl, onAudioEnd, lipSyncMode = "textbased", isDarkMode = false, affectionLevel = "distant", onTap, avatarState = "idle" }: AvatarStageProps) {
  const palette = useMemo(() => {
    if (!emotion) {
      return emotionPalette.neutral;
    }
    return emotionPalette[emotion.emotion] || emotionPalette.neutral;
  }, [emotion]);

  // Mood-reactive gradient background
  const moodGradient = useMemo(() => {
    const base = isDarkMode ? "#0c0a14" : "#fffdf8";
    return `radial-gradient(ellipse at 50% 80%, ${palette.primary}30, ${palette.accent}15, ${base})`;
  }, [palette, isDarkMode]);

  // Tap-to-interact: distinguish tap from orbit drag
  const pointerStart = useRef<{ x: number; y: number; time: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointerStart.current || !onTap) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const elapsed = Date.now() - pointerStart.current.time;
    // Tap: small movement + quick press
    if (dist < 5 && elapsed < 300) {
      onTap();
    }
    pointerStart.current = null;
  }, [onTap]);

  // Convert relative audio URLs to absolute URLs pointing to backend
  const absoluteAudioUrl = useMemo(() => {
    if (!audioUrl) return undefined;

    // If it's already an absolute URL, use it as-is
    if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
      return audioUrl;
    }

    // If it's a relative URL, prepend the backend URL
    const backendUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL?.replace('/ws', '').replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:8000';
    const fullUrl = `${backendUrl}${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
    return fullUrl;
  }, [audioUrl]);

  // Use provided avatarUrl, then env var, then default to Moe
  const modelUrl = avatarUrl || process.env.NEXT_PUBLIC_VRM_URL || "/avatars/Moe.vrm";

  // Detect if this is a Live2D model
  const isLive2D = isLive2DModel(modelUrl);

  // Get the initial preset based on device and view mode
  const initialPresetKey = typeof window !== "undefined" ? getPresetKey(viewMode) : viewMode;
  const initialPreset = VIEW_PRESETS[initialPresetKey];
  const initialFov = initialPreset.fov + (AFFECTION_FOV_OFFSET[affectionLevel] ?? 0);

  // Render Live2D avatar if it's a Live2D model
  if (isLive2D) {
    return (
      <div className="h-full w-full relative" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
        <div
          className="absolute inset-0 transition-all duration-[1500ms]"
          style={{ background: moodGradient }}
        />
        <div className="relative h-full w-full">
          <Suspense fallback={<Live2DLoadingIndicator />}>
            <Live2DAvatar
              key={modelUrl}
              modelUrl={modelUrl}
              emotion={emotion}
              audioUrl={absoluteAudioUrl}
              lipSync={lipSync}
              onAudioEnd={onAudioEnd}
              avatarState={avatarState}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  // Render VRM avatar (Three.js canvas)
  return (
    <div className="h-full w-full relative" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
      <div
        className="absolute inset-0 transition-all duration-[1500ms]"
        style={{ background: moodGradient }}
      />
      <Canvas
        shadows
        camera={{ position: initialPreset.position.toArray() as [number, number, number], fov: initialFov }}
        gl={{ alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
        className="relative"
      >
        <ambientLight intensity={0.6} color="#ffffff" />
        <directionalLight position={[0.7, 1.8, 1.2]} intensity={1.4} color="#ffffff" />
        <directionalLight position={[-0.7, 1.5, 1]} intensity={0.8} color="#f3f4ff" />
        <Suspense fallback={<LoadingIndicator />}>
          <VRMAvatar key={modelUrl} url={modelUrl} emotion={emotion} audioUrl={absoluteAudioUrl} lipSync={lipSync} outfitVisibility={outfitVisibility} onAudioEnd={onAudioEnd} lipSyncMode={lipSyncMode} avatarState={avatarState} />
        </Suspense>
        <CameraController viewMode={viewMode} affectionLevel={affectionLevel} />
      </Canvas>
    </div>
  );
}
