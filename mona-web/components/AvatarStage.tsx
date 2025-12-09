"use client";

import { Suspense, useMemo, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import dynamic from "next/dynamic";
import type { EmotionData } from "@/types/chat";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

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

interface AvatarStageProps {
  emotion: EmotionData | null;
  audioUrl?: string;
  viewMode?: "portrait" | "full";
}

// Camera presets for different view modes
const VIEW_PRESETS = {
  portrait: {
    position: new THREE.Vector3(0, 1.35, 1.2),
    target: new THREE.Vector3(0, 1.25, 0),
  },
  full: {
    position: new THREE.Vector3(0, 0.85, 1.8),
    target: new THREE.Vector3(0, 0.75, 0),
  },
};

// Component to handle camera transitions
function CameraController({ viewMode }: { viewMode: "portrait" | "full" }) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    const preset = VIEW_PRESETS[viewMode];

    // Animate camera position
    const startPos = camera.position.clone();
    const endPos = preset.position;
    const startTime = performance.now();
    const duration = 500; // ms

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      camera.position.lerpVectors(startPos, endPos, eased);

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
    />
  );
}

export default function AvatarStage({ emotion, audioUrl, viewMode = "full" }: AvatarStageProps) {
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

  const vrmUrl = process.env.NEXT_PUBLIC_VRM_URL || "/avatars/Mona1.vrm";
  const initialPreset = VIEW_PRESETS[viewMode];

  return (
    <div className="h-full w-full">
      <Canvas
        shadows
        camera={{ position: initialPreset.position.toArray() as [number, number, number], fov: 42 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.35 }}
      >
        <color attach="background" args={["#f7f8ff"]} />
        <ambientLight intensity={1.4} color="#ffffff" />
        <directionalLight position={[0.7, 1.8, 1.2]} intensity={1.6} color="#ffffff" />
        <directionalLight position={[-0.7, 1.5, 1]} intensity={0.9} color="#f3f4ff" />
        <Suspense fallback={null}>
          <VRMAvatar url={vrmUrl} emotion={emotion} audioUrl={absoluteAudioUrl} />
        </Suspense>
        <CameraController viewMode={viewMode} />
      </Canvas>
    </div>
  );
}
