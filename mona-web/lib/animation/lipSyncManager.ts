import { VRM } from "@pixiv/three-vrm";
import { LipSyncCue, LipSyncMode, FormantConfig } from "@/types/chat";

/**
 * Configuration for lip sync behavior
 */
export interface LipSyncConfig {
  /** Smoothing factor for animation transitions (0-1) */
  smoothingFactor: number;
  /** Minimum amplitude threshold to trigger mouth movement */
  amplitudeThreshold: number;
  /** Multiplier for mouth opening intensity */
  amplitudeScale: number;
  /** Maximum mouth opening (0-1) - varies by avatar */
  maxMouthOpen: number;
  /** Spectral centroid thresholds for phoneme classification */
  centroidThresholds: {
    wide: number; // ee sound
    ih: number; // ih sound
    oh: number; // oh sound
  };
  /** Lip sync mode: 'timed', 'realtime', 'formant', or 'mobile' */
  mode?: LipSyncMode;
  /** Formant-based lip sync configuration (only used when mode='formant') */
  formantConfig?: FormantConfig;
}

// Default max mouth open for avatars (Moe, Lily use higher value)
const DEFAULT_MAX_MOUTH_OPEN = 0.75;

const DEFAULT_CONFIG: LipSyncConfig = {
  smoothingFactor: 0.15, // Lower = snappier transitions for clearer enunciation
  amplitudeThreshold: 0.02, // Higher threshold to ignore quiet sounds
  amplitudeScale: 0.8, // Increased scale for more visible mouth movements
  maxMouthOpen: DEFAULT_MAX_MOUTH_OPEN,
  centroidThresholds: {
    wide: 0.75,
    ih: 0.5,
    oh: 0.25,
  },
};

// Much faster smoothing for closing mouth on silence (between words)
// Higher value = faster closing for clearer word separation
const SILENCE_SMOOTHING_FACTOR = 0.65;

// Default formant-based lip sync configuration
const DEFAULT_FORMANT_CONFIG: FormantConfig = {
  f1Weight: 0.6,
  f2Weight: 0.8,
  consonantSensitivity: 0.4,
  useAsymmetricEasing: true,
  attackMultiplier: 1.0,
  releaseMultiplier: 1.0,
  amplitudeModulation: true,
  microMovementEnabled: true,
  microMovementAmplitude: 0.02,
};

// Formant analysis result
interface FormantAnalysis {
  f1Energy: number;    // First formant energy (jaw open indicator)
  f2Energy: number;    // Second formant energy (lip shape indicator)
  f1Centroid: number;  // Weighted center of F1 region (0-1)
  f2Centroid: number;  // Weighted center of F2 region (0-1)
}

// Asymmetric easing profile per phoneme
interface AsymmetricEasing {
  attackFactor: number;   // Speed of increase (higher = faster)
  releaseFactor: number;  // Speed of decrease (lower = smoother)
}

// Easing profiles per phoneme type - fast attack, smooth release
const PHONEME_EASING: Record<keyof PhonemeValues, AsymmetricEasing> = {
  aa: { attackFactor: 0.35, releaseFactor: 0.12 }, // Jaw: fast open, slow close
  ee: { attackFactor: 0.40, releaseFactor: 0.15 }, // Front vowel: quick
  ih: { attackFactor: 0.30, releaseFactor: 0.10 }, // Mid vowel: moderate
  oh: { attackFactor: 0.25, releaseFactor: 0.08 }, // Round vowel: slower
  ou: { attackFactor: 0.30, releaseFactor: 0.10 }, // Pucker: moderate
};

// Micro-movement state for natural variation
interface MicroMovementState {
  phase: number;
  frequency: number;
  amplitude: number;
}

type PhonemeValues = {
  aa: number;
  ee: number;
  ih: number;
  oh: number;
  ou: number;
};

/**
 * Manages lip sync animation for VRM avatars.
 * Supports two modes:
 * 1. Phoneme-timed: Uses pre-computed timing data from backend for accurate word sync
 * 2. Real-time audio analysis: Fallback using amplitude and spectral centroid
 */
export class LipSyncManager {
  private vrm: VRM;
  private config: LipSyncConfig;
  private audioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private timeDomainBuffer: Uint8Array<ArrayBuffer> | null = null;
  private frequencyBuffer: Uint8Array<ArrayBuffer> | null = null;
  private previousPhonemeValues: PhonemeValues = {
    aa: 0,
    ee: 0,
    ih: 0,
    oh: 0,
    ou: 0,
  };
  private isMobile: boolean = false;

  // Phoneme-timed lip sync data
  private lipSyncCues: LipSyncCue[] | null = null;
  private useTimedLipSync: boolean = false;

  // Track if we're supposed to be playing (even if blocked by autoplay)
  private shouldBePlaying: boolean = false;

  // Micro-movement state for formant mode (natural variation)
  private microMovement: MicroMovementState = {
    phase: 0,
    frequency: 5 + Math.random() * 3, // 5-8 Hz
    amplitude: 0.02,
  };

  // Callback for when audio ends (for queued playback)
  private onAudioEndedCallback: (() => void) | null = null;

  constructor(vrm: VRM, config: Partial<LipSyncConfig> = {}) {
    this.vrm = vrm;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Detect mobile devices
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  /**
   * Update lip sync configuration at runtime
   */
  updateConfig(newConfig: Partial<LipSyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Set lip sync timing data from backend.
   * When set, the manager will use phoneme-timed animation instead of real-time audio analysis.
   */
  setLipSyncData(cues: LipSyncCue[] | null): void {
    this.lipSyncCues = cues;
    this.useTimedLipSync = cues !== null && cues.length > 0;
  }

  /**
   * Check if phoneme-timed lip sync is available
   */
  hasTimedLipSync(): boolean {
    return this.useTimedLipSync;
  }

  /**
   * Initialize audio analysis for the given audio URL.
   * MOBILE FIX: Reuses the pre-unlocked audio element from useAudioContext
   * to bypass autoplay restrictions.
   */
  setupAudio(audioUrl: string): void {
    // Reset mobile animation timer and play state for fresh lip sync
    this.mobileAnimationTimer = 0;
    this.shouldBePlaying = false;

    // MOBILE FIX: Reuse the pre-unlocked audio element if available
    // This element was "unlocked" during user interaction in useAudioContext
    const unlockedAudio = (window as any).__monaUnlockedAudio as HTMLAudioElement | undefined;

    if (this.isMobile && unlockedAudio) {
      // Stop any current playback on the unlocked element
      unlockedAudio.pause();
      unlockedAudio.currentTime = 0;

      // Set crossOrigin BEFORE setting src (required for Web Audio API)
      // This enables real-time lip sync analysis on mobile
      if (!unlockedAudio.crossOrigin) {
        unlockedAudio.crossOrigin = "anonymous";
      }

      // Set the new source
      unlockedAudio.src = audioUrl;

      // Ensure volume is at max
      unlockedAudio.volume = 1.0;

      // Store reference
      this.audioElement = unlockedAudio;
    } else {
      // DESKTOP or fallback: Create new audio element
      // CRITICAL: Clean up old audio element and source before creating new ones
      if (this.audioElement && this.audioElement !== unlockedAudio) {
        const oldAudio = this.audioElement;
        oldAudio.pause();
        oldAudio.currentTime = 0; // Reset playback position
        oldAudio.src = ""; // Release the old audio
        oldAudio.load(); // Force browser to release resources
        this.audioElement = null; // Clear reference immediately
      }

      if (this.source) {
        this.source.disconnect();
        this.source = null;
      }

      // CRITICAL: Create Audio element synchronously to preserve user interaction context
      this.audioElement = new Audio();

      // Mobile Chrome fix: Only use crossOrigin if NOT on mobile
      // crossOrigin="anonymous" can cause issues on some mobile browsers
      if (!this.isMobile) {
        this.audioElement.crossOrigin = "anonymous";
      }

      // Set source after crossOrigin configuration
      this.audioElement.src = audioUrl;

      // Mobile-specific attributes for better compatibility (fallback path)
      if (this.isMobile) {
        this.audioElement.setAttribute("playsinline", "true");
        this.audioElement.setAttribute("webkit-playsinline", "true");
        // Use auto preload for mobile to ensure audio is ready faster
        this.audioElement.preload = "auto";
        // Ensure volume is at max
        this.audioElement.volume = 1.0;
      } else {
        this.audioElement.preload = "auto";
      }
    }

    // Load audio asynchronously (doesn't block play())
    this.audioElement.load();

    // Setup Web Audio API analysis chain for real-time lip sync
    // This enables the same natural lip sync on both mobile and desktop

    // Use global AudioContext if available (initialized from user interaction)
    if (!this.audioContext) {
      this.audioContext = (window as any).__monaAudioContext;
      if (!this.audioContext) {
        // Create it anyway
        try {
          this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
          return;
        }
      }
    }

    try {
      // For Web Audio API to work, we need crossOrigin on the audio element
      // On mobile with the pre-unlocked element, we need to set this carefully
      if (!this.audioElement.crossOrigin) {
        // Only set crossOrigin if not already set - setting it clears the src
        const currentSrc = this.audioElement.src;
        this.audioElement.crossOrigin = "anonymous";
        // Restore src after setting crossOrigin (setting crossOrigin clears it)
        if (currentSrc && !this.audioElement.src) {
          this.audioElement.src = currentSrc;
          this.audioElement.load();
        }
      }

      // Create new MediaElementSource for this audio element
      // Note: Each audio element can only have ONE MediaElementSource
      // If we've already created one for this element, reuse it
      if (!this.source) {
        this.source = this.audioContext.createMediaElementSource(this.audioElement);
      }

      // Create analyser if we don't have one, or reuse existing
      if (!this.analyser) {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.timeDomainBuffer = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
        this.frequencyBuffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      }

      // Connect the audio routing: source -> analyser -> speakers
      // Only connect if not already connected
      try {
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      } catch (connectError) {
        // May already be connected - that's OK
      }
    } catch (error) {
      // Don't throw - allow fallback to work
      // Clear source so we don't try to use it
      this.source = null;
      this.analyser = null;
    }
  }

  /**
   * Resume audio context if suspended (required for some browsers)
   * CRITICAL for mobile: Must be called in direct user interaction context
   */
  async resumeAudio(): Promise<void> {
    if (this.audioContext?.state === "suspended") {
      try {
        await this.audioContext.resume();
      } catch (error) {
        throw error;
      }
    }
  }

  /**
   * Initialize AudioContext in direct user interaction.
   * MUST be called from a user gesture handler on mobile.
   */
  async initAudioContext(): Promise<void> {
    if (this.audioContext) {
      await this.resumeAudio();
      return;
    }

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Mobile browsers require immediate resume
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Play the loaded audio
   * MOBILE FIX: Must be called synchronously within user interaction context
   */
  play(): void {
    if (!this.audioElement) {
      return;
    }

    // Mark that we intend to play (for mobile fallback lip sync)
    this.shouldBePlaying = true;

    // Resume AudioContext if needed (desktop only - mobile skips Web Audio API)
    if (!this.isMobile && this.audioContext?.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }

    // Add event listeners to track playback state on mobile
    if (this.isMobile) {
      this.audioElement.onended = () => {
        this.shouldBePlaying = false; // Audio finished, stop lip sync
        // Call the callback for queued audio playback
        if (this.onAudioEndedCallback) {
          this.onAudioEndedCallback();
        }
      };
    }

    // Add event listeners to track playback on desktop too
    if (!this.isMobile) {
      this.audioElement.onended = () => {
        this.shouldBePlaying = false;
        // Call the callback for queued audio playback
        if (this.onAudioEndedCallback) {
          this.onAudioEndedCallback();
        }
      };
    }

    const playPromise = this.audioElement.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Silently handle autoplay policy errors
      });
    }
  }

  /**
   * Pause the loaded audio
   */
  pause(): void {
    this.audioElement?.pause();
  }

  /**
   * Stop and reset the current audio playback.
   * Used when user sends a new message to prioritize the new response.
   * Note: Does not dispose the shared unlocked audio element on mobile.
   */
  stop(): void {
    this.shouldBePlaying = false; // Clear play intent
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      // Don't clear src on mobile's shared element - just stop playback
    }
    this.mobileAnimationTimer = 0; // Reset mobile fallback animation
    this.resetMouth();
  }

  /**
   * Set callback for when audio playback ends (for queued playback)
   */
  setOnAudioEnded(callback: (() => void) | null): void {
    this.onAudioEndedCallback = callback;
  }

  /**
   * Check if audio is currently playing
   * Used to adjust animation parameters (more dynamic when talking)
   */
  isPlaying(): boolean {
    return this.audioElement !== null &&
           !this.audioElement.paused &&
           !this.audioElement.ended;
  }

  /**
   * Reset all mouth expressions to neutral
   */
  resetMouth(): void {
    const phonemes: (keyof PhonemeValues)[] = ["aa", "ee", "ih", "oh", "ou"];
    const expressionManager = this.vrm.expressionManager;

    if (!expressionManager) return;

    for (const phoneme of phonemes) {
      expressionManager.setValue(phoneme, 0);
      this.previousPhonemeValues[phoneme] = 0;
    }
  }

  /**
   * Update lip sync animation based on current audio playback.
   * Call this every frame in your animation loop.
   * Supports modes: 'formant' (new), 'timed', 'realtime', 'mobile'
   */
  update(): void {
    const expressionManager = this.vrm.expressionManager;
    if (!expressionManager) {
      return;
    }

    // NEW: Formant mode - advanced frequency band analysis with layered animation
    if (this.config.mode === 'formant' && this.analyser && this.timeDomainBuffer && this.frequencyBuffer) {
      this.updateFormantLipSync(expressionManager);
      return;
    }

    // Use phoneme-timed lip sync if available (mode='timed' or default when data exists)
    if (this.useTimedLipSync && this.lipSyncCues && this.audioElement) {
      this.updateTimedLipSync(expressionManager);
      return;
    }

    // Fallback to real-time audio analysis (desktop with Web Audio API)
    if (this.analyser && this.timeDomainBuffer && this.frequencyBuffer) {
      // Get audio analysis data
      this.analyser.getByteTimeDomainData(this.timeDomainBuffer);
      this.analyser.getByteFrequencyData(this.frequencyBuffer);

      // Calculate RMS amplitude
      const amplitude = this.calculateRMSAmplitude(this.timeDomainBuffer);

      // Calculate spectral centroid (brightness of sound)
      const centroid = this.calculateSpectralCentroid(this.frequencyBuffer);

      // Map to phoneme shapes
      const phonemeValues = this.estimatePhonemes(amplitude, centroid);

      // Apply smoothing and update VRM expressions
      this.applySmoothedPhonemes(phonemeValues, expressionManager);
      return;
    }

    // MOBILE FALLBACK: Simple amplitude simulation based on audio playback state
    // Since Web Audio API is not available on mobile, we create a simple
    // mouth movement pattern when audio is playing OR when we intend to play
    // (shouldBePlaying covers the case where autoplay is blocked but we want lip sync)
    const isActuallyPlaying = this.audioElement && !this.audioElement.paused && !this.audioElement.ended;
    const shouldAnimateMouth = this.isMobile && this.audioElement && (isActuallyPlaying || this.shouldBePlaying);

    if (shouldAnimateMouth) {
      this.updateMobileFallbackLipSync(expressionManager);
      return;
    }

    // No audio playing - close mouth
    if (!this.shouldBePlaying && this.audioElement && (this.audioElement.paused || this.audioElement.ended)) {
      this.applySmoothedPhonemes({ aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 }, expressionManager);
    }
  }

  /**
   * Mobile fallback lip sync - creates simple mouth movement when audio plays.
   * Uses a sine wave pattern to open/close mouth since we can't analyze audio.
   */
  private mobileAnimationTimer = 0;
  private updateMobileFallbackLipSync(
    expressionManager: NonNullable<VRM["expressionManager"]>
  ): void {
    // Increment timer based on frame rate (~60fps assumed)
    this.mobileAnimationTimer += 0.016;

    // Safety timeout: Stop lip sync after 30 seconds max (in case audio never ends)
    // This prevents infinite mouth animation if something goes wrong
    if (this.mobileAnimationTimer > 30) {
      this.shouldBePlaying = false;
      return;
    }

    // Create a varying mouth movement pattern
    // Use multiple sine waves at different frequencies for more natural movement
    const wave1 = Math.sin(this.mobileAnimationTimer * 8) * 0.5 + 0.5; // Fast variation
    const wave2 = Math.sin(this.mobileAnimationTimer * 3) * 0.3 + 0.5; // Slower variation
    const combined = (wave1 * 0.6 + wave2 * 0.4);

    // Cap at maxMouthOpen for natural appearance
    const mouthOpen = Math.min(this.config.maxMouthOpen, combined * 0.5);

    // Alternate between different mouth shapes for variety
    const shapePhase = Math.floor(this.mobileAnimationTimer * 4) % 4;
    const phonemes: PhonemeValues = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };

    phonemes.aa = mouthOpen; // Base jaw open
    switch (shapePhase) {
      case 0: phonemes.ee = mouthOpen * 0.5; break;
      case 1: phonemes.oh = mouthOpen * 0.7; break;
      case 2: phonemes.ih = mouthOpen * 0.6; break;
      case 3: phonemes.ou = mouthOpen * 0.4; break;
    }

    this.applySmoothedPhonemes(phonemes, expressionManager);
  }

  /**
   * Update lip sync using pre-computed phoneme timing data.
   * Much more accurate than real-time audio analysis.
   * Includes interpolation between cues and faster closing on silence.
   */
  private updateTimedLipSync(
    expressionManager: NonNullable<VRM["expressionManager"]>
  ): void {
    if (!this.audioElement || !this.lipSyncCues) return;

    const currentTime = this.audioElement.currentTime;

    // Find the current cue, previous cue, and next cue for interpolation
    let prevCue: LipSyncCue | null = null;
    let currentCue: LipSyncCue | null = null;
    let nextCue: LipSyncCue | null = null;

    for (let i = 0; i < this.lipSyncCues.length; i++) {
      const cue = this.lipSyncCues[i];
      if (currentTime >= cue.start && currentTime < cue.end) {
        prevCue = this.lipSyncCues[i - 1] ?? null;
        currentCue = cue;
        nextCue = this.lipSyncCues[i + 1] ?? null;
        break;
      }
    }

    // Check if this is a silence cue (mouth should close quickly)
    const isSilence = currentCue?.phonemes && '_silence' in currentCue.phonemes;

    // Get target phoneme values
    let targetValues: PhonemeValues;

    if (!currentCue) {
      // No cue found - close mouth
      targetValues = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
    } else {
      // Get base values from current cue (filter out _silence flag)
      const { _silence, ...phonemes } = currentCue.phonemes as PhonemeValues & { _silence?: boolean };
      targetValues = {
        aa: phonemes.aa ?? 0,
        ee: phonemes.ee ?? 0,
        ih: phonemes.ih ?? 0,
        oh: phonemes.oh ?? 0,
        ou: phonemes.ou ?? 0,
      };

      const cueDuration = currentCue.end - currentCue.start;
      const timeIntoCue = currentTime - currentCue.start;
      const timeUntilEnd = currentCue.end - currentTime;

      // Coarticulation: Blend from previous cue at the start (first 30% of cue)
      // This makes transitions INTO phonemes smoother
      const blendInWindow = Math.min(0.08, cueDuration * 0.3); // 80ms or 30% of cue
      if (prevCue && timeIntoCue < blendInWindow) {
        const blendFactor = timeIntoCue / blendInWindow; // 0 at start, 1 at end of window
        const { _silence: prevSilence, ...prevPhonemes } = prevCue.phonemes as PhonemeValues & { _silence?: boolean };

        for (const key of ['aa', 'ee', 'ih', 'oh', 'ou'] as const) {
          const prevVal = prevPhonemes[key] ?? 0;
          // Blend from previous value toward current
          targetValues[key] = prevVal + (targetValues[key] - prevVal) * blendFactor;
        }
      }

      // Coarticulation: Blend toward next cue at the end (last 30% of cue)
      // This creates anticipation of the next phoneme
      const blendOutWindow = Math.min(0.08, cueDuration * 0.3); // 80ms or 30% of cue
      if (nextCue && timeUntilEnd < blendOutWindow) {
        const blendFactor = 1 - (timeUntilEnd / blendOutWindow); // 0 at start, 1 at very end
        const { _silence: nextSilence, ...nextPhonemes } = nextCue.phonemes as PhonemeValues & { _silence?: boolean };

        for (const key of ['aa', 'ee', 'ih', 'oh', 'ou'] as const) {
          const nextVal = nextPhonemes[key] ?? 0;
          // Blend toward next value (use 0.6 factor so we don't fully reach next shape)
          targetValues[key] = targetValues[key] + (nextVal - targetValues[key]) * blendFactor * 0.6;
        }
      }
    }

    // Apply smoothing - use faster smoothing for silence to close mouth quickly between words
    this.applySmoothedPhonemes(targetValues, expressionManager, isSilence);
  }

  /**
   * Calculate root mean square amplitude from time domain data
   */
  private calculateRMSAmplitude(buffer: Uint8Array): number {
    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      const normalized = (buffer[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    return Math.sqrt(sumSquares / buffer.length);
  }

  /**
   * Calculate spectral centroid (normalized 0-1)
   */
  private calculateSpectralCentroid(buffer: Uint8Array): number {
    let weightedSum = 0;
    let magnitudeSum = 0;

    for (let i = 0; i < buffer.length; i++) {
      const magnitude = buffer[i];
      weightedSum += i * magnitude;
      magnitudeSum += magnitude;
    }

    return magnitudeSum > 0 ? weightedSum / magnitudeSum / buffer.length : 0;
  }

  /**
   * Estimate phoneme values based on amplitude and spectral centroid
   */
  private estimatePhonemes(amplitude: number, centroid: number): PhonemeValues {
    const { amplitudeThreshold, amplitudeScale, maxMouthOpen, centroidThresholds } = this.config;
    const phonemes: PhonemeValues = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };

    if (amplitude > amplitudeThreshold) {
      // Calculate level and cap it to prevent mouth opening too wide
      const rawLevel = (amplitude - amplitudeThreshold) * amplitudeScale;
      const level = Math.min(maxMouthOpen, rawLevel);

      // aa (jaw open) always gets some level for any speech
      phonemes.aa = level;

      // Classify vowel shape by spectral brightness
      if (centroid > centroidThresholds.wide) {
        phonemes.ee = level * 0.7; // Bright vowel (ee) - slightly less
      } else if (centroid > centroidThresholds.ih) {
        phonemes.ih = level * 0.8; // Mid vowel (ih)
      } else if (centroid > centroidThresholds.oh) {
        phonemes.oh = level * 0.9; // Dark vowel (oh)
      } else {
        phonemes.ou = level; // Darkest vowel (ou)
      }
    }

    return phonemes;
  }

  /**
   * Apply smoothed phoneme values to VRM expression manager
   * @param useFastDecay - If true, use faster smoothing to close mouth quickly (for silence between words)
   */
  private applySmoothedPhonemes(
    targetValues: PhonemeValues,
    expressionManager: NonNullable<VRM["expressionManager"]>,
    useFastDecay: boolean = false
  ): void {
    const { smoothingFactor } = this.config;

    for (const phoneme of Object.keys(targetValues) as (keyof PhonemeValues)[]) {
      const target = targetValues[phoneme];
      const previous = this.previousPhonemeValues[phoneme];

      // Use faster smoothing for silence to close mouth quickly between words
      // Otherwise use normal smoothing for natural speech transitions
      const effectiveSmoothingFactor = useFastDecay && target < previous
        ? SILENCE_SMOOTHING_FACTOR
        : smoothingFactor;

      // Exponential smoothing
      const smoothed = previous + effectiveSmoothingFactor * (target - previous);
      this.previousPhonemeValues[phoneme] = smoothed;

      expressionManager.setValue(phoneme, smoothed);
    }
  }

  // ============================================
  // FORMANT MODE - New lip sync implementation
  // ============================================

  /**
   * Analyze frequency bands for formant-based vowel detection.
   * Returns energy and centroid for F1 (jaw) and F2 (lip shape) regions.
   */
  private analyzeFrequencyBands(buffer: Uint8Array): FormantAnalysis {
    const sampleRate = this.audioContext?.sampleRate ?? 44100;
    const fftSize = this.analyser?.fftSize ?? 2048;
    const binWidth = sampleRate / fftSize;

    // Frequency band definitions (in Hz)
    const F1_LOW = 200, F1_HIGH = 900;   // First formant (jaw opening)
    const F2_LOW = 900, F2_HIGH = 2500;  // Second formant (lip shape)

    // Convert to bin indices
    const f1StartBin = Math.floor(F1_LOW / binWidth);
    const f1EndBin = Math.min(buffer.length, Math.ceil(F1_HIGH / binWidth));
    const f2StartBin = Math.floor(F2_LOW / binWidth);
    const f2EndBin = Math.min(buffer.length, Math.ceil(F2_HIGH / binWidth));

    // Calculate energy and weighted centroid for F1 region
    let f1Energy = 0, f1WeightedSum = 0, f1MagnitudeSum = 0;
    for (let i = f1StartBin; i < f1EndBin; i++) {
      const magnitude = buffer[i] / 255;
      f1Energy += magnitude * magnitude;
      f1WeightedSum += i * magnitude;
      f1MagnitudeSum += magnitude;
    }

    // Calculate energy and weighted centroid for F2 region
    let f2Energy = 0, f2WeightedSum = 0, f2MagnitudeSum = 0;
    for (let i = f2StartBin; i < f2EndBin; i++) {
      const magnitude = buffer[i] / 255;
      f2Energy += magnitude * magnitude;
      f2WeightedSum += i * magnitude;
      f2MagnitudeSum += magnitude;
    }

    const f1BinCount = f1EndBin - f1StartBin;
    const f2BinCount = f2EndBin - f2StartBin;

    return {
      f1Energy: Math.sqrt(f1Energy / Math.max(1, f1BinCount)),
      f2Energy: Math.sqrt(f2Energy / Math.max(1, f2BinCount)),
      f1Centroid: f1MagnitudeSum > 0
        ? (f1WeightedSum / f1MagnitudeSum - f1StartBin) / f1BinCount
        : 0.5,
      f2Centroid: f2MagnitudeSum > 0
        ? (f2WeightedSum / f2MagnitudeSum - f2StartBin) / f2BinCount
        : 0.5,
    };
  }

  /**
   * Detect consonant presence from high-frequency energy.
   * Returns 0-1 indicating sibilant/fricative strength.
   */
  private detectConsonants(buffer: Uint8Array): number {
    const sampleRate = this.audioContext?.sampleRate ?? 44100;
    const fftSize = this.analyser?.fftSize ?? 2048;
    const binWidth = sampleRate / fftSize;

    // Sibilant frequency range: 4000-10000 Hz
    const sibilantStartBin = Math.floor(4000 / binWidth);
    const sibilantEndBin = Math.min(buffer.length, Math.ceil(10000 / binWidth));

    // Calculate RMS energy in sibilant band
    let sibilantEnergy = 0;
    for (let i = sibilantStartBin; i < sibilantEndBin; i++) {
      const magnitude = buffer[i] / 255;
      sibilantEnergy += magnitude * magnitude;
    }
    sibilantEnergy = Math.sqrt(sibilantEnergy / Math.max(1, sibilantEndBin - sibilantStartBin));

    // Calculate total energy for comparison
    let totalEnergy = 0;
    for (let i = 0; i < buffer.length; i++) {
      const magnitude = buffer[i] / 255;
      totalEnergy += magnitude * magnitude;
    }
    totalEnergy = Math.sqrt(totalEnergy / buffer.length);

    // Return ratio clamped to 0-1
    if (totalEnergy < 0.01) return 0;
    return Math.min(1, (sibilantEnergy / totalEnergy) * 2);
  }

  /**
   * Estimate phonemes using layered formant analysis.
   * Layer 1: Jaw opening based on F1 energy + amplitude
   * Layer 2: Lip shape based on F2 centroid position
   */
  private estimatePhonemesFormant(
    amplitude: number,
    formants: FormantAnalysis,
    consonantLevel: number
  ): PhonemeValues {
    const { amplitudeThreshold, amplitudeScale, maxMouthOpen } = this.config;
    const formantConfig = this.config.formantConfig ?? DEFAULT_FORMANT_CONFIG;
    const phonemes: PhonemeValues = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };

    if (amplitude < amplitudeThreshold) {
      return phonemes;
    }

    // === LAYER 1: Jaw Opening ===
    // Combine amplitude with F1 energy for natural jaw movement
    const rawJawLevel = (amplitude - amplitudeThreshold) * amplitudeScale;
    const f1Contribution = formants.f1Energy * formantConfig.f1Weight;
    const jawLevel = Math.min(maxMouthOpen, rawJawLevel * (0.6 + f1Contribution));
    phonemes.aa = jawLevel;

    // === LAYER 2: Lip Shape ===
    // Use F2 centroid to determine vowel quality
    // Low F2 = back vowels (oh, ou), High F2 = front vowels (ee, ih)
    const f2Position = formants.f2Centroid; // 0 = low, 1 = high

    // Also consider F1 for open vs closed vowels
    // High F1 = open vowels (aa, oh), Low F1 = closed vowels (ee, ou)
    const f1Position = formants.f1Centroid;

    // Vowel quadrant classification with lip intensity
    const lipIntensity = jawLevel * formantConfig.f2Weight;

    if (f2Position > 0.6) {
      // Front vowels (high F2)
      if (f1Position < 0.4) {
        phonemes.ee = lipIntensity;  // High front: /i/ as in "beet"
      } else {
        phonemes.ih = lipIntensity;  // Mid front: /e/ as in "bet"
      }
    } else if (f2Position < 0.4) {
      // Back vowels (low F2)
      if (f1Position < 0.4) {
        phonemes.ou = lipIntensity;  // High back: /u/ as in "boot"
      } else {
        phonemes.oh = lipIntensity;  // Mid back: /o/ as in "boat"
      }
    } else {
      // Central vowels - blend based on position
      const frontWeight = (f2Position - 0.4) / 0.2;
      phonemes.ih = lipIntensity * frontWeight;
      phonemes.oh = lipIntensity * (1 - frontWeight);
    }

    // === CONSONANT OVERLAY ===
    // High frequencies indicate sibilants - reduce mouth opening, add lip tension
    if (consonantLevel > formantConfig.consonantSensitivity) {
      const consonantFactor = (consonantLevel - formantConfig.consonantSensitivity) /
                               (1 - formantConfig.consonantSensitivity);
      // Sibilants (s, sh, f, th) have minimal jaw opening
      phonemes.aa *= (1 - consonantFactor * 0.6);
      // Add slight lip tension for sibilants
      phonemes.ih = Math.max(phonemes.ih, consonantFactor * 0.25);
    }

    return phonemes;
  }

  /**
   * Apply asymmetric smoothing - fast attack, smooth release.
   * Makes consonants snappy and vowels natural.
   */
  private applyAsymmetricSmoothing(
    targetValues: PhonemeValues,
    expressionManager: NonNullable<VRM["expressionManager"]>,
    useFastDecay: boolean = false
  ): void {
    const formantConfig = this.config.formantConfig ?? DEFAULT_FORMANT_CONFIG;

    for (const phoneme of Object.keys(targetValues) as (keyof PhonemeValues)[]) {
      const target = targetValues[phoneme];
      const previous = this.previousPhonemeValues[phoneme];
      const easing = PHONEME_EASING[phoneme];

      // Choose factor based on direction
      let factor: number;
      if (target > previous) {
        // Attacking (opening) - use faster factor
        factor = easing.attackFactor * formantConfig.attackMultiplier;
      } else if (useFastDecay) {
        // Silence - use fastest decay
        factor = SILENCE_SMOOTHING_FACTOR;
      } else {
        // Releasing (closing) - use smoother factor
        factor = easing.releaseFactor * formantConfig.releaseMultiplier;
      }

      // Apply exponential smoothing
      const smoothed = previous + factor * (target - previous);
      this.previousPhonemeValues[phoneme] = smoothed;
      expressionManager.setValue(phoneme, smoothed);
    }
  }

  /**
   * Add micro-movement variation to phoneme values.
   * Simulates natural muscle tremor and breathing for realistic animation.
   */
  private addMicroMovement(values: PhonemeValues, deltaTime: number = 0.016): PhonemeValues {
    const formantConfig = this.config.formantConfig ?? DEFAULT_FORMANT_CONFIG;

    // Update phase
    this.microMovement.phase += deltaTime * this.microMovement.frequency * Math.PI * 2;

    // Wrap phase to prevent floating point issues over time
    if (this.microMovement.phase > Math.PI * 20) {
      this.microMovement.phase -= Math.PI * 20;
    }

    const variation = Math.sin(this.microMovement.phase) * formantConfig.microMovementAmplitude;

    return {
      aa: Math.max(0, values.aa + variation * 0.8),
      ee: Math.max(0, values.ee + variation * 0.5),
      ih: Math.max(0, values.ih + variation * 0.5),
      oh: Math.max(0, values.oh + variation * 0.6),
      ou: Math.max(0, values.ou + variation * 0.4),
    };
  }

  /**
   * Main update method for formant-based lip sync.
   * Uses frequency band analysis, layered animation, and asymmetric easing.
   */
  private updateFormantLipSync(
    expressionManager: NonNullable<VRM["expressionManager"]>
  ): void {
    if (!this.analyser || !this.frequencyBuffer || !this.timeDomainBuffer) return;

    const formantConfig = this.config.formantConfig ?? DEFAULT_FORMANT_CONFIG;

    // Get audio data
    this.analyser.getByteTimeDomainData(this.timeDomainBuffer);
    this.analyser.getByteFrequencyData(this.frequencyBuffer);

    // Calculate amplitude
    const amplitude = this.calculateRMSAmplitude(this.timeDomainBuffer);

    // Formant analysis
    const formants = this.analyzeFrequencyBands(this.frequencyBuffer);
    const consonantLevel = this.detectConsonants(this.frequencyBuffer);

    // Layered phoneme estimation
    let phonemeValues = this.estimatePhonemesFormant(amplitude, formants, consonantLevel);

    // Amplitude modulation from timed data (if available and enabled)
    if (formantConfig.amplitudeModulation && this.lipSyncCues && this.audioElement) {
      const currentTime = this.audioElement.currentTime;
      const currentCue = this.lipSyncCues.find(
        cue => currentTime >= cue.start && currentTime < cue.end
      );

      if (currentCue) {
        // Blend formant detection with timed phoneme hints
        const timedValues = currentCue.phonemes;
        const blendFactor = 0.3; // 30% influence from timed data

        phonemeValues = {
          aa: phonemeValues.aa * (1 - blendFactor) + (timedValues.aa ?? 0) * blendFactor * amplitude * 2,
          ee: phonemeValues.ee * (1 - blendFactor) + (timedValues.ee ?? 0) * blendFactor * amplitude * 2,
          ih: phonemeValues.ih * (1 - blendFactor) + (timedValues.ih ?? 0) * blendFactor * amplitude * 2,
          oh: phonemeValues.oh * (1 - blendFactor) + (timedValues.oh ?? 0) * blendFactor * amplitude * 2,
          ou: phonemeValues.ou * (1 - blendFactor) + (timedValues.ou ?? 0) * blendFactor * amplitude * 2,
        };
      }
    }

    // Micro-movement for natural variation
    if (formantConfig.microMovementEnabled) {
      phonemeValues = this.addMicroMovement(phonemeValues);
    }

    // Apply with asymmetric easing (fast attack, smooth release)
    const isSilence = amplitude < this.config.amplitudeThreshold;
    this.applyAsymmetricSmoothing(phonemeValues, expressionManager, isSilence);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Don't dispose the shared unlocked audio element - just pause it
    const unlockedAudio = (window as any).__monaUnlockedAudio as HTMLAudioElement | undefined;

    if (this.audioElement) {
      this.audioElement.pause();

      // Only null out if it's NOT the shared unlocked audio element
      if (this.audioElement !== unlockedAudio) {
        this.audioElement = null;
      }
    }

    // Disconnect source if it exists
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    // Note: Don't close AudioContext or destroy analyser - they're reused
    // this.audioContext?.close();
    // this.audioContext = null;
    // this.analyser = null;
    // this.timeDomainBuffer = null;
    // this.frequencyBuffer = null;
  }
}
