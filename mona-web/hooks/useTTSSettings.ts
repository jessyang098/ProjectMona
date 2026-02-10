"use client";

import { useState, useEffect, useCallback } from "react";
import { TtsEngine, LipSyncMode, PersonalityType } from "@/components/SettingsModal";
import { ToastType } from "@/contexts/ToastContext";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export function useTTSSettings(showToast?: (msg: string, type?: ToastType) => void) {
  const [ttsEngine, setTtsEngine] = useState<TtsEngine>("sovits");
  const [lipSyncMode, setLipSyncMode] = useState<LipSyncMode>("formant");
  const [personality, setPersonality] = useState<PersonalityType>("girlfriend");
  const [isPersonalitySwitching, setIsPersonalitySwitching] = useState(false);

  // Load saved personality preference on mount
  useEffect(() => {
    const savedPersonality = localStorage.getItem("mona_personality") as PersonalityType | null;
    if (savedPersonality && (savedPersonality === "girlfriend" || savedPersonality === "mommy")) {
      setPersonality(savedPersonality);
      // Sync with backend
      fetch(`${BACKEND_URL}/personalities/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personality_id: savedPersonality }),
      }).catch(console.error);
    }
  }, []);

  // Handle personality switch
  const handlePersonalityChange = useCallback(async (newPersonality: PersonalityType) => {
    if (newPersonality === personality || isPersonalitySwitching) return;

    setIsPersonalitySwitching(true);
    try {
      const response = await fetch(`${BACKEND_URL}/personalities/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personality_id: newPersonality }),
      });

      if (response.ok) {
        setPersonality(newPersonality);
        // Store preference in localStorage
        localStorage.setItem("mona_personality", newPersonality);
      } else {
        const error = await response.json();
        console.error("Failed to switch personality:", error);
        showToast?.("Failed to switch personality. Please try again.", "error");
      }
    } catch (error) {
      console.error("Error switching personality:", error);
      showToast?.("Failed to switch personality. Please try again.", "error");
    } finally {
      setIsPersonalitySwitching(false);
    }
  }, [personality, isPersonalitySwitching]);

  return {
    ttsEngine,
    setTtsEngine,
    lipSyncMode,
    setLipSyncMode,
    personality,
    isPersonalitySwitching,
    handlePersonalityChange,
  };
}
