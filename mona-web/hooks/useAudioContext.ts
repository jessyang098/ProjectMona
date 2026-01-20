import { useRef, useCallback } from "react";

/**
 * Hook to manage a global AudioContext for mobile compatibility.
 * MUST be initialized from a direct user interaction on mobile browsers.
 *
 * MOBILE FIX: Also creates a "pre-unlocked" audio element that can be reused
 * for all subsequent audio playback. On mobile browsers, an audio element
 * that has successfully called play() in a user gesture context can continue
 * to play new audio sources without additional user gestures.
 */
export function useAudioContext() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const initializedRef = useRef(false);

  /**
   * Initialize AudioContext from user interaction.
   * Safe to call multiple times - will only create once.
   *
   * CRITICAL FOR MOBILE: This also creates and "unlocks" a global audio element
   * by playing a short silent audio. This pre-unlocked element can then be
   * reused for all subsequent audio playback without being blocked.
   */
  const initAudioContext = useCallback(async () => {
    if (initializedRef.current && audioContextRef.current) {
      // Resume if suspended
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
      return audioContextRef.current;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      initializedRef.current = true;

      // Mobile browsers may start suspended - resume immediately
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      // Store globally for LipSyncManager access
      (window as any).__monaAudioContext = audioContextRef.current;

      // MOBILE FIX: Create and unlock a global audio element
      // This element can be reused for all audio playback
      await unlockMobileAudio();

      return audioContextRef.current;
    } catch (error) {
      throw error;
    }
  }, []);

  return { initAudioContext };
}

/**
 * Unlock mobile audio by playing a short silent audio.
 * This must be called from a user gesture handler.
 * Once unlocked, the audio element can play any audio source.
 */
async function unlockMobileAudio(): Promise<void> {
  // Check if already unlocked
  if ((window as any).__monaUnlockedAudio) {
    return;
  }

  // Create a new audio element
  const audio = new Audio();

  // Mobile-specific attributes
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  audio.volume = 1.0;
  audio.preload = "auto";

  // Set crossOrigin for Web Audio API compatibility (enables real-time lip sync)
  audio.crossOrigin = "anonymous";

  // Create a very short silent audio using a data URI
  // This is a minimal valid MP3 file (silence)
  const silentMp3 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  audio.src = silentMp3;

  try {
    // Play the silent audio - this "unlocks" the element
    await audio.play();

    // Store globally for LipSyncManager to reuse
    (window as any).__monaUnlockedAudio = audio;

    // Stop the silent audio (element stays unlocked)
    audio.pause();
    audio.currentTime = 0;
  } catch (error) {
    // Don't throw - this is not critical on desktop
  }
}
