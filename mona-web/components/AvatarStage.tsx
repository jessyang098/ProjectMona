"use client";

import { Suspense, useMemo, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import dynamic from "next/dynamic";
import type { EmotionData, LipSyncCue } from "@/types/chat";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { OutfitVisibility } from "./VRMAvatar";
export type { OutfitVisibility };

const VRMAvatar = dynamic(() => import("./VRMAvatar"), { ssr: false });

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
  { id: "moe", label: "Moe", url: "/avatars/Moe.vrm" },
  { id: "mona1", label: "Mona", url: "/avatars/Mona1.vrm" },
] as const;

export type AvatarId = typeof AVATAR_OPTIONS[number]["id"];

interface AvatarStageProps {
  emotion: EmotionData | null;
  audioUrl?: string;
  lipSync?: LipSyncCue[];
  viewMode?: "portrait" | "full";
  outfitVisibility?: OutfitVisibility;
  avatarUrl?: string;
}

// Camera presets for different view modes
const VIEW_PRESETS = {
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
};

// Component to handle camera transitions
function CameraController({ viewMode }: { viewMode: "portrait" | "full" }) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const lastLogTime = useRef(0);

  useEffect(() => {
    const preset = VIEW_PRESETS[viewMode];

    // Animate camera position and FOV
    const startPos = camera.position.clone();
    const endPos = preset.position;
    const startFov = (camera as THREE.PerspectiveCamera).fov;
    const endFov = preset.fov;
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
  }, [viewMode, camera]);

  // Log camera position on change (throttled to avoid spam)
  const handleCameraChange = () => {
    const now = Date.now();
    if (now - lastLogTime.current < 500) return; // Throttle to every 500ms
    lastLogTime.current = now;

    const perspCamera = camera as THREE.PerspectiveCamera;
    const target = controlsRef.current?.target;
    console.log("📷 Camera position:", {
      position: {
        x: camera.position.x.toFixed(3),
        y: camera.position.y.toFixed(3),
        z: camera.position.z.toFixed(3),
      },
      target: target ? {
        x: target.x.toFixed(3),
        y: target.y.toFixed(3),
        z: target.z.toFixed(3),
      } : null,
      fov: perspCamera.fov.toFixed(1),
    });
  };

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      target={VIEW_PRESETS[viewMode].target.toArray() as [number, number, number]}
      minDistance={0.8}
      maxDistance={5}
      minPolarAngle={Math.PI / 4}
      maxPolarAngle={Math.PI / 1.5}
      enableDamping={true}
      dampingFactor={0.05}
      onChange={handleCameraChange}
    />
  );
}

export default function AvatarStage({ emotion, audioUrl, lipSync, viewMode = "full", outfitVisibility, avatarUrl }: AvatarStageProps) {
  const palette = useMemo(() => {
    if (!emotion) {
      return emotionPalette.neutral;
    }
    return emotionPalette[emotion.emotion] || emotionPalette.neutral;
  }, [emotion]);

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
    console.log(`🔗 Converted relative audio URL: ${audioUrl} -> ${fullUrl}`);
    return fullUrl;
  }, [audioUrl]);

  console.log("🎬 AvatarStage received audioUrl:", audioUrl);
  console.log("🎬 Absolute audioUrl:", absoluteAudioUrl);

  // Use provided avatarUrl, then env var, then default to Moe
  const vrmUrl = avatarUrl || process.env.NEXT_PUBLIC_VRM_URL || "/avatars/Moe.vrm";
  const initialPreset = VIEW_PRESETS[viewMode];

  return (
    <div className="h-full w-full">
      <Canvas
        shadows
        camera={{ position: initialPreset.position.toArray() as [number, number, number], fov: 42 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
      >
        <color attach="background" args={["#fffdf8"]} />
        <ambientLight intensity={0.6} color="#ffffff" />
        <directionalLight position={[0.7, 1.8, 1.2]} intensity={1.4} color="#ffffff" />
        <directionalLight position={[-0.7, 1.5, 1]} intensity={0.8} color="#f3f4ff" />
        <Suspense fallback={null}>
          <VRMAvatar key={vrmUrl} url={vrmUrl} emotion={emotion} audioUrl={absoluteAudioUrl} lipSync={lipSync} outfitVisibility={outfitVisibility} />
        </Suspense>
        <CameraController viewMode={viewMode} />
      </Canvas>
    </div>
  );
}
