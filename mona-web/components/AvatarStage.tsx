"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import dynamic from "next/dynamic";
import type { EmotionData } from "@/types/chat";
import * as THREE from "three";

const VRMAvatar = dynamic(() => import("./VRMAvatar"), { ssr: false });

const emotionPalette: Record<string, { primary: string; accent: string }> = {
  happy: { primary: "#ff9de6", accent: "#ffd1f7" },
  excited: { primary: "#ffd166", accent: "#ffe29a" },
  content: { primary: "#9be7ff", accent: "#d5f4ff" },
  curious: { primary: "#a5b4ff", accent: "#d8deff" },
  surprised: { primary: "#ffb7b2", accent: "#ffdada" },
  concerned: { primary: "#fca5a5", accent: "#fdd5d5" },
  sad: { primary: "#9ca3af", accent: "#cbd5f5" },
  embarrassed: { primary: "#f9a8d4", accent: "#fbcfe8" },
  affectionate: { primary: "#f472b6", accent: "#fbcfe8" },
  neutral: { primary: "#c4c4ff", accent: "#e4e4ff" },
};

interface AvatarStageProps {
  emotion: EmotionData | null;
  audioUrl?: string;
}

export default function AvatarStage({ emotion, audioUrl }: AvatarStageProps) {
  const palette = useMemo(() => {
    if (!emotion) {
      return emotionPalette.neutral;
    }
    return emotionPalette[emotion.emotion] || emotionPalette.neutral;
  }, [emotion]);

  console.log("🎬 AvatarStage received audioUrl:", audioUrl);

  const vrmUrl = process.env.NEXT_PUBLIC_VRM_URL || "/avatars/Mona1.vrm";

  return (
    <div className="h-full w-full">
      <Canvas
        shadows
        camera={{ position: [0, 0.9, 1.8], fov: 26 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.35 }}
      >
        <color attach="background" args={["#f7f8ff"]} />
        <ambientLight intensity={1.4} color="#ffffff" />
        <directionalLight position={[0.7, 1.8, 1.2]} intensity={1.6} color="#ffffff" />
        <directionalLight position={[-0.7, 1.5, 1]} intensity={0.9} color="#f3f4ff" />
        <Suspense fallback={null}>
          <VRMAvatar url={vrmUrl} emotion={emotion} audioUrl={audioUrl} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableRotate={false}
          target={[0, 1.0, 0]}
        />
      </Canvas>
    </div>
  );
}
