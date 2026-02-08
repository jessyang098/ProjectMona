"use client";

import { useState, useEffect } from "react";

export type TtsEngine = "sovits" | "fishspeech" | "cartesia";
export type LipSyncMode = "textbased" | "realtime" | "formant";
export type PersonalityType = "girlfriend" | "mommy";

export interface PersonalityOption {
  id: PersonalityType;
  name: string;
  description: string;
}

export const PERSONALITY_OPTIONS: PersonalityOption[] = [
  {
    id: "girlfriend",
    name: "Girlfriend",
    description: "Playful, teasing, chaotic energy. Banter and roasting.",
  },
  {
    id: "mommy",
    name: "Nurturing",
    description: "Warm, caring, protective. Comforting with praise.",
  },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  isDarkMode: boolean;
  onDarkModeChange: (isDark: boolean) => void;
  ttsEngine: TtsEngine;
  onTtsEngineChange: (engine: TtsEngine) => void;
  lipSyncMode: LipSyncMode;
  onLipSyncModeChange: (mode: LipSyncMode) => void;
  personality: PersonalityType;
  onPersonalityChange: (personality: PersonalityType) => void;
  isPersonalitySwitching?: boolean;
}

export default function SettingsModal({
  isOpen,
  onClose,
  volume,
  onVolumeChange,
  isDarkMode,
  onDarkModeChange,
  ttsEngine,
  onTtsEngineChange,
  lipSyncMode,
  onLipSyncModeChange,
  personality,
  onPersonalityChange,
  isPersonalitySwitching = false,
}: SettingsModalProps) {
  const [localVolume, setLocalVolume] = useState(volume);

  // Sync local volume with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalVolume(volume);
    }
  }, [isOpen, volume]);

  if (!isOpen) return null;

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setLocalVolume(newVolume);
    onVolumeChange(newVolume);
  };

  const getVolumeIcon = () => {
    if (localVolume === 0) {
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      );
    }
    if (localVolume < 0.5) {
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      );
    }
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      </svg>
    );
  };

  const ttsOptions: { id: TtsEngine; label: string }[] = [
    { id: "sovits", label: "GPT-SoVITS" },
    { id: "fishspeech", label: "Fish Speech" },
    { id: "cartesia", label: "Cartesia" },
  ];

  const lipSyncOptions: { id: LipSyncMode; label: string }[] = [
    { id: "textbased", label: "Text" },
    { id: "realtime", label: "Real-time" },
    { id: "formant", label: "Formant" },
  ];

  const ttsDescription =
    ttsEngine === "sovits"
      ? "GPT-SoVITS: Fine-tuned Mona voice"
      : ttsEngine === "fishspeech"
      ? "Fish Speech: Zero-shot voice cloning via API"
      : "Cartesia Sonic: Low-latency streaming TTS";

  const lipSyncDescription =
    lipSyncMode === "textbased"
      ? "Text: Fast phoneme estimation from text (~0ms)"
      : lipSyncMode === "realtime"
      ? "Real-time: Basic audio frequency analysis"
      : "Formant: Advanced F1/F2 analysis with layered animation";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 border border-slate-200 dark:bg-slate-800 dark:border-slate-600 animate-fadeInScale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-300"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <h2 className="mb-6 text-xl font-bold text-slate-900 dark:text-white">Settings</h2>

        {/* ===== PERSONALITY SECTION ===== */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-600">
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Personality
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {PERSONALITY_OPTIONS.map((option) => {
              const isSelected = personality === option.id;
              const isGirlfriend = option.id === "girlfriend";

              return (
                <button
                  key={option.id}
                  onClick={() => onPersonalityChange(option.id)}
                  disabled={isPersonalitySwitching}
                  className={`relative flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    isSelected
                      ? "border-pink-400 bg-pink-50 dark:border-pink-500 dark:bg-pink-950/30"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700/50 dark:hover:border-slate-500"
                  } ${isPersonalitySwitching ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  style={{ minHeight: "80px" }}
                >
                  {/* Checkmark badge */}
                  {isSelected && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}

                  {/* Spinner when switching */}
                  {isPersonalitySwitching && !isSelected && (
                    <span className="absolute right-2 top-2">
                      <svg className="h-4 w-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </span>
                  )}

                  {/* Icon + Name row */}
                  <div className="mb-1 flex items-center gap-2">
                    {isGirlfriend ? (
                      <svg className={`h-4 w-4 ${isSelected ? "text-pink-500" : "text-slate-400 dark:text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    ) : (
                      <svg className={`h-4 w-4 ${isSelected ? "text-pink-500" : "text-slate-400 dark:text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    )}
                    <span className={`text-sm font-semibold ${isSelected ? "text-pink-600 dark:text-pink-400" : "text-slate-700 dark:text-slate-200"}`}>
                      {option.name}
                    </span>
                  </div>

                  {/* Description */}
                  <p className={`text-xs leading-snug ${isSelected ? "text-pink-500/80 dark:text-pink-400/70" : "text-slate-400 dark:text-slate-500"}`}>
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== VOICE SECTION ===== */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-600">
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Voice
            </span>
          </div>

          {/* Voice Engine */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Voice Engine
            </label>
            <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-700">
              {ttsOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => onTtsEngineChange(option.id)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    ttsEngine === option.id
                      ? "bg-pink-500 text-white shadow-sm dark:bg-pink-600"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              {ttsDescription}
            </p>
          </div>

          {/* Lip Sync */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Lip Sync
            </label>
            <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-700">
              {lipSyncOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => onLipSyncModeChange(option.id)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    lipSyncMode === option.id
                      ? "bg-pink-500 text-white shadow-sm dark:bg-pink-600"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              {lipSyncDescription}
            </p>
          </div>
        </div>

        {/* ===== DISPLAY SECTION ===== */}
        <div>
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-600">
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Display
            </span>
          </div>

          {/* Dark Mode Toggle */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span className="text-slate-500 dark:text-slate-400">
                  {isDarkMode ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                </span>
                Dark Mode
              </label>
              <button
                onClick={() => onDarkModeChange(!isDarkMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors border ${
                  isDarkMode ? "bg-pink-500 border-pink-500" : "bg-slate-200 border-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDarkMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              Switch between light and dark themes
            </p>
          </div>

          {/* Volume Control */}
          <div>
            <label className="mb-3 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">{getVolumeIcon()}</span>
                Volume
              </span>
              <span className="text-slate-500 dark:text-slate-400">{Math.round(localVolume * 100)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={localVolume}
              onChange={handleVolumeChange}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-pink-500 dark:bg-slate-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
