"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Float, OrbitControls } from "@react-three/drei";
import type { EmotionData } from "@/types/chat";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import dynamic from "next/dynamic";

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

const intensityScale: Record<string, number> = {
  low: 0.0,
  medium: 0.15,
  high: 0.3,
};

interface AvatarPanelProps {
  emotion: EmotionData | null;
  isConnected: boolean;
}

export default function AvatarPanel({ emotion, isConnected }: AvatarPanelProps) {
  const vrmUrl = process.env.NEXT_PUBLIC_VRM_URL || "/avatars/Mona1.vrm";
  const palette = useMemo(() => {
    if (!emotion) {
      return emotionPalette.neutral;
    }
    return emotionPalette[emotion.emotion] || emotionPalette.neutral;
  }, [emotion]);

  const statusText = emotion
    ? `${emotion.emotion} (${emotion.intensity})`
    : isConnected
    ? "Calibrating..."
    : "Awaiting link";

  return (
    <div className="flex h-full flex-col rounded-3xl border border-purple-500/20 bg-black/40 p-4 shadow-[0_20px_60px_rgba(139,92,246,0.35)] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-purple-300/70">Holoroom</p>
          <h2 className="text-2xl font-semibold text-white">Mona Presence</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs text-purple-100">
          {statusText}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-[#12061f] via-[#1f0d33] to-[#05010a]">
        <Canvas shadows camera={{ position: [0, 1.6, 4.3], fov: 45 }}>
          <color attach="background" args={["#07040d"]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[2, 4, 3]} intensity={1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
          <Suspense fallback={null}>
            <AvatarScene emotion={emotion} palette={palette} vrmUrl={vrmUrl} />
          </Suspense>
          <OrbitControls enablePan={false} minPolarAngle={Math.PI / 6} maxPolarAngle={Math.PI / 2.1} enableZoom={false} />
        </Canvas>
      </div>

      <div className="mt-4 rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-purple-50">
        <p className="font-semibold text-purple-100">Room Status</p>
        <p className="mt-1 text-purple-200/80">
          {emotion
            ? "Avatar glow, accent color, and idle motion respond to her latest emotional pulse."
            : "Once Mona reacts to you, her room lights and posture will mirror that feeling."}
        </p>
      </div>
    </div>
  );
}

interface AvatarSceneProps {
  emotion: EmotionData | null;
  palette: { primary: string; accent: string };
  vrmUrl?: string;
}

function AvatarScene({ emotion, palette, vrmUrl }: AvatarSceneProps) {
  const intensity = intensityScale[emotion?.intensity ?? "medium"];

  return (
    <group>
      <RoomFloor palette={palette} />
      {vrmUrl ? (
        <VRMAvatar url={vrmUrl} emotion={emotion} />
      ) : (
        <AvatarCore palette={palette} intensity={intensity} />
      )}
      <BackgroundGlow palette={palette} />
    </group>
  );
}

function AvatarCore({
  palette,
  intensity,
}: {
  palette: { primary: string; accent: string };
  intensity: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.3) * 0.4;
    meshRef.current.position.y = 1 + Math.sin(clock.elapsedTime * 1.1) * (0.2 + intensity);
  });

  return (
    <Float speed={2} floatIntensity={0.6 + intensity} rotationIntensity={0.4}>
      <mesh ref={meshRef} castShadow>
        <icosahedronGeometry args={[0.9 + intensity, 1]} />
        <meshStandardMaterial
          color={palette.primary}
          emissive={palette.accent}
          emissiveIntensity={0.6 + intensity}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>
    </Float>
  );
}

function RoomFloor({ palette }: { palette: { primary: string; accent: string } }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[3.8, 64]} />
        <meshStandardMaterial color={"#130619"} roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.2, 2.4, 64]} />
        <meshBasicMaterial color={palette.primary} transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, 0.2, -2.6]}
        rotation={[0, 0, 0]}
        receiveShadow>
        <planeGeometry args={[8, 4]} />
        <meshStandardMaterial color={"#12061f"} emissive={palette.primary} emissiveIntensity={0.12} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function BackgroundGlow({ palette }: { palette: { primary: string; accent: string } }) {
  return (
    <group>
      <pointLight position={[0, 2.5, 0]} intensity={1.6} color={palette.primary} distance={6} decay={2} />
      <mesh position={[0, 2.3, -3]}>
        <planeGeometry args={[6, 3]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.08} />
      </mesh>
    </group>
  );
}
