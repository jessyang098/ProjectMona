"use client";

import { useState, useEffect } from "react";

export type TtsEngine = "sovits" | "fishspeech";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  isDarkMode: boolean;
  onDarkModeChange: (isDark: boolean) => void;
  ttsEngine: TtsEngine;
  onTtsEngineChange: (engine: TtsEngine) => void;
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <h2 className="mb-6 text-xl font-bold text-slate-900 dark:text-white">Settings</h2>

        {/* Volume Control */}
        <div className="mb-6">
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

        {/* Dark Mode Toggle */}
        <div className="mb-6">
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
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isDarkMode ? "bg-pink-500" : "bg-slate-200"
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

        {/* TTS Engine Selection */}
        <div className="mb-6">
          <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span className="text-slate-500 dark:text-slate-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </span>
            Voice Engine
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => onTtsEngineChange("sovits")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                ttsEngine === "sovits"
                  ? "bg-pink-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              }`}
            >
              GPT-SoVITS
            </button>
            <button
              onClick={() => onTtsEngineChange("fishspeech")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                ttsEngine === "fishspeech"
                  ? "bg-pink-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              }`}
            >
              Fish Speech
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {ttsEngine === "sovits"
              ? "GPT-SoVITS: Fine-tuned Mona voice"
              : "Fish Speech: Zero-shot voice cloning via API"}
          </p>
        </div>

        {/* Divider */}
        <div className="mb-4 h-px bg-slate-200 dark:bg-slate-600" />
      </div>
    </div>
  );
}
