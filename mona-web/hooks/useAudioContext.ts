import { useRef, useCallback } from "react";

/**
 * Hook to manage a global AudioContext for mobile compatibility.
 * MUST be initialized from a direct user interaction on mobile browsers.
 */
export function useAudioContext() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const initializedRef = useRef(false);

  /**
   * Initialize AudioContext from user interaction.
   * Safe to call multiple times - will only create once.
   */
  const initAudioContext = useCallback(async () => {
    if (initializedRef.current && audioContextRef.current) {
      console.log("ℹ️ AudioContext already initialized");
      // Resume if suspended
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
        console.log("✅ AudioContext resumed");
      }
      return audioContextRef.current;
    }

    console.log("🎵 Creating AudioContext from user interaction...");
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      initializedRef.current = true;

      console.log("✅ AudioContext created, state:", audioContextRef.current.state);

      // Mobile browsers may start suspended - resume immediately
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
        console.log("✅ AudioContext resumed after creation");
      }

      // Store globally for LipSyncManager access
      (window as any).__monaAudioContext = audioContextRef.current;

      return audioContextRef.current;
    } catch (error) {
      console.error("❌ Failed to create AudioContext:", error);
      throw error;
    }
  }, []);

  return { initAudioContext };
}
