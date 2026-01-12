import { VRM } from "@pixiv/three-vrm";
import { LipSyncCue } from "@/types/chat";

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
}

// Default max mouth open for avatars (Moe, Lily use higher value)
const DEFAULT_MAX_MOUTH_OPEN = 0.55;

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

// Faster smoothing for closing mouth on silence (between words)
const SILENCE_SMOOTHING_FACTOR = 0.4;

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
 * 1. Phoneme-timed: Uses pre-computed timing data from Rhubarb for accurate word sync
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

  // Callback for when audio ends (for queued playback)
  private onAudioEndedCallback: (() => void) | null = null;

  constructor(vrm: VRM, config: Partial<LipSyncConfig> = {}) {
    this.vrm = vrm;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Detect mobile devices
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    console.log("📱 Mobile device detected:", this.isMobile);
  }

  /**
   * Update lip sync configuration at runtime
   */
  updateConfig(newConfig: Partial<LipSyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Set lip sync timing data from Rhubarb analysis.
   * When set, the manager will use phoneme-timed animation instead of real-time audio analysis.
   */
  setLipSyncData(cues: LipSyncCue[] | null): void {
    this.lipSyncCues = cues;
    this.useTimedLipSync = cues !== null && cues.length > 0;
    if (this.useTimedLipSync) {
      console.log(`👄 Lip sync: Using ${cues!.length} phoneme cues for accurate word sync`);
    } else {
      console.log("👄 Lip sync: Falling back to real-time audio analysis");
    }
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
    console.log("🎵 LipSyncManager.setupAudio called with:", audioUrl);
    console.log("🎵 Full audio URL that will be loaded:", new URL(audioUrl, window.location.href).href);
    console.log("📱 isMobile:", this.isMobile);

    // Reset mobile animation timer and play state for fresh lip sync
    this.mobileAnimationTimer = 0;
    this.shouldBePlaying = false;

    // MOBILE FIX: Reuse the pre-unlocked audio element if available
    // This element was "unlocked" during user interaction in useAudioContext
    const unlockedAudio = (window as any).__monaUnlockedAudio as HTMLAudioElement | undefined;

    if (this.isMobile && unlockedAudio) {
      console.log("📱 Using pre-unlocked audio element for mobile");

      // Stop any current playback on the unlocked element
      unlockedAudio.pause();
      unlockedAudio.currentTime = 0;

      // Set crossOrigin BEFORE setting src (required for Web Audio API)
      // This enables real-time lip sync analysis on mobile
      if (!unlockedAudio.crossOrigin) {
        unlockedAudio.crossOrigin = "anonymous";
        console.log("📱 Set crossOrigin=anonymous for Web Audio API");
      }

      // Set the new source
      unlockedAudio.src = audioUrl;

      // Ensure volume is at max
      unlockedAudio.volume = 1.0;

      // Store reference
      this.audioElement = unlockedAudio;

      console.log("📱 Pre-unlocked audio element configured with new source");
      console.log("🎵 Audio element src set to:", this.audioElement.src);
    } else {
      // DESKTOP or fallback: Create new audio element
      // CRITICAL: Clean up old audio element and source before creating new ones
      if (this.audioElement && this.audioElement !== unlockedAudio) {
        console.log("🧹 Cleaning up previous audio element");
        const oldAudio = this.audioElement;
        oldAudio.pause();
        oldAudio.currentTime = 0; // Reset playback position
        oldAudio.src = ""; // Release the old audio
        oldAudio.load(); // Force browser to release resources
        this.audioElement = null; // Clear reference immediately
      }

      if (this.source) {
        console.log("🧹 Disconnecting previous audio source");
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

      console.log("🎵 Audio element src set to:", this.audioElement.src);
      console.log("🎵 crossOrigin:", this.audioElement.crossOrigin || "not set (mobile)");

      // Mobile-specific attributes for better compatibility (fallback path)
      if (this.isMobile) {
        this.audioElement.setAttribute("playsinline", "true");
        this.audioElement.setAttribute("webkit-playsinline", "true");
        // Use auto preload for mobile to ensure audio is ready faster
        this.audioElement.preload = "auto";
        // Ensure volume is at max
        this.audioElement.volume = 1.0;
        console.log("📱 Mobile audio attributes applied (preload: auto, volume: 1.0)");
      } else {
        this.audioElement.preload = "auto";
      }
    }

    console.log("🎵 Audio element created");

    // Setup event listeners (these fire asynchronously but don't block play())
    this.audioElement.oncanplaythrough = () => {
      console.log("✅ Audio can play through - ready for playback");
    };

    this.audioElement.onloadedmetadata = () => {
      console.log("📊 Audio metadata loaded:", {
        duration: this.audioElement?.duration,
        readyState: this.audioElement?.readyState,
      });
    };

    this.audioElement.onerror = () => {
      // Network state 2 (NETWORK_IDLE) with no error often happens when browser aborts loading
      // This can be normal during rapid audio switching - only log if there's an actual error
      if (this.audioElement?.error) {
        const mediaError = this.audioElement.error;
        console.error("❌ Audio loading failed - MediaError code:", mediaError.code);
        console.error("   Message:", mediaError.message);
        console.error("   Codes: 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED");
        console.error("   Audio src:", this.audioElement.src);
      } else if (this.audioElement?.networkState !== 2) {
        // Only log if it's not the common NETWORK_IDLE state
        console.warn("⚠️ Audio error (no MediaError):", {
          networkState: this.audioElement?.networkState,
          readyState: this.audioElement?.readyState,
          src: this.audioElement?.src,
        });
      }
    };

    // Load audio asynchronously (doesn't block play())
    console.log("🎵 Loading audio...");
    this.audioElement.load();

    // Setup Web Audio API analysis chain for real-time lip sync
    // This enables the same natural lip sync on both mobile and desktop
    console.log("🎵 Setting up Web Audio API...");

    // Use global AudioContext if available (initialized from user interaction)
    if (!this.audioContext) {
      this.audioContext = (window as any).__monaAudioContext;
      if (this.audioContext) {
        console.log("✅ Using pre-initialized global AudioContext");
      } else {
        console.warn("⚠️ No global AudioContext found!");
        // Create it anyway
        try {
          this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          console.log("⚠️ AudioContext created without user interaction");
        } catch (e) {
          console.error("❌ Failed to create AudioContext:", e);
          console.log("📱 Will use fallback lip sync animation");
          return;
        }
      }
    }

    console.log("🎵 AudioContext state:", this.audioContext.state);

    try {
      // For Web Audio API to work, we need crossOrigin on the audio element
      // On mobile with the pre-unlocked element, we need to set this carefully
      if (!this.audioElement.crossOrigin) {
        // Only set crossOrigin if not already set - setting it clears the src
        console.log("🎵 Setting crossOrigin for Web Audio API...");
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
        console.log("🎵 Creating MediaElementSource...");
        this.source = this.audioContext.createMediaElementSource(this.audioElement);
        console.log("🎵 MediaElementSource created");
      } else {
        console.log("🎵 Reusing existing MediaElementSource");
      }

      // Create analyser if we don't have one, or reuse existing
      if (!this.analyser) {
        console.log("🎵 Creating new AnalyserNode...");
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.timeDomainBuffer = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
        this.frequencyBuffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      } else {
        console.log("🎵 Reusing existing AnalyserNode");
      }

      // Connect the audio routing: source -> analyser -> speakers
      // Only connect if not already connected
      console.log("🎵 Connecting audio routing: source -> analyser -> destination");
      try {
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      } catch (connectError) {
        // May already be connected - that's OK
        console.log("🎵 Audio routing may already be connected");
      }

      console.log("✅ Web Audio API setup complete");
      console.log("🎵 Audio routing: audioElement -> MediaElementSource -> AnalyserNode -> AudioDestination (speakers)");
    } catch (error) {
      console.error("❌ Failed to set up Web Audio API:", error);
      console.log("📱 Will use fallback lip sync animation instead");
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
      console.log("🎵 Resuming suspended AudioContext...");
      try {
        await this.audioContext.resume();
        console.log("✅ AudioContext resumed, state:", this.audioContext.state);
      } catch (error) {
        console.error("❌ Failed to resume AudioContext:", error);
        throw error;
      }
    } else {
      console.log("ℹ️ AudioContext state:", this.audioContext?.state || "no context");
    }
  }

  /**
   * Initialize AudioContext in direct user interaction.
   * MUST be called from a user gesture handler on mobile.
   */
  async initAudioContext(): Promise<void> {
    if (this.audioContext) {
      console.log("ℹ️ AudioContext already exists, resuming if needed");
      await this.resumeAudio();
      return;
    }

    console.log("🎵 Creating AudioContext from user interaction...");
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log("✅ AudioContext created, state:", this.audioContext.state);

      // Mobile browsers require immediate resume
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
        console.log("✅ AudioContext resumed after creation, state:", this.audioContext.state);
      }
    } catch (error) {
      console.error("❌ Failed to create AudioContext:", error);
      throw error;
    }
  }

  /**
   * Play the loaded audio
   * MOBILE FIX: Must be called synchronously within user interaction context
   */
  play(): void {
    console.log("▶️ LipSyncManager.play() called");

    if (!this.audioElement) {
      console.error("❌ No audio element to play");
      return;
    }

    // Mark that we intend to play (for mobile fallback lip sync)
    this.shouldBePlaying = true;

    // Log detailed audio element state
    console.log("📊 Audio element state:", {
      src: this.audioElement.src,
      readyState: this.audioElement.readyState,
      readyStateDesc: ["HAVE_NOTHING", "HAVE_METADATA", "HAVE_CURRENT_DATA", "HAVE_FUTURE_DATA", "HAVE_ENOUGH_DATA"][this.audioElement.readyState],
      paused: this.audioElement.paused,
      currentTime: this.audioElement.currentTime,
      duration: this.audioElement.duration,
      volume: this.audioElement.volume,
      muted: this.audioElement.muted,
      networkState: this.audioElement.networkState,
      networkStateDesc: ["NETWORK_EMPTY", "NETWORK_IDLE", "NETWORK_LOADING", "NETWORK_NO_SOURCE"][this.audioElement.networkState],
      isMobile: this.isMobile,
      hasLipSyncCues: this.useTimedLipSync,
      lipSyncCueCount: this.lipSyncCues?.length ?? 0,
    });

    // Resume AudioContext if needed (desktop only - mobile skips Web Audio API)
    if (!this.isMobile && this.audioContext?.state === "suspended") {
      console.log("🎵 Resuming suspended AudioContext synchronously...");
      this.audioContext.resume().catch((error) => {
        console.error("❌ Failed to resume AudioContext:", error);
      });
    }

    // Add event listeners to track playback state on mobile
    if (this.isMobile) {
      this.audioElement.onplay = () => console.log("📱 [Mobile] Audio play event fired");
      this.audioElement.onplaying = () => console.log("📱 [Mobile] Audio playing event fired - AUDIO IS NOW PLAYING");
      this.audioElement.onpause = () => console.log("📱 [Mobile] Audio pause event fired");
      this.audioElement.onended = () => {
        console.log("📱 [Mobile] Audio ended event fired");
        this.shouldBePlaying = false; // Audio finished, stop lip sync
        // Call the callback for queued audio playback
        if (this.onAudioEndedCallback) {
          this.onAudioEndedCallback();
        }
      };
      this.audioElement.onstalled = () => console.log("📱 [Mobile] Audio stalled event - network issue");
      this.audioElement.onwaiting = () => console.log("📱 [Mobile] Audio waiting event - buffering");
      this.audioElement.ontimeupdate = () => {
        // Log every 0.5 seconds of playback
        if (Math.floor(this.audioElement!.currentTime * 2) !== Math.floor((this.audioElement!.currentTime - 0.1) * 2)) {
          console.log(`📱 [Mobile] Audio time: ${this.audioElement!.currentTime.toFixed(2)}s / ${this.audioElement!.duration.toFixed(2)}s`);
        }
      };
    }

    // CRITICAL: Call play() synchronously to preserve user interaction context
    console.log("▶️ Calling audioElement.play() synchronously...");

    // Add event listeners to track playback on desktop too
    if (!this.isMobile) {
      this.audioElement.onplay = () => console.log("🖥️ [Desktop] Audio play event fired");
      this.audioElement.onplaying = () => console.log("🖥️ [Desktop] Audio playing event - AUDIO IS NOW PLAYING");
      this.audioElement.onpause = () => console.log("🖥️ [Desktop] Audio pause event fired");
      this.audioElement.onended = () => {
        console.log("🖥️ [Desktop] Audio ended event fired");
        this.shouldBePlaying = false;
        // Call the callback for queued audio playback
        if (this.onAudioEndedCallback) {
          this.onAudioEndedCallback();
        }
      };
      this.audioElement.onerror = () => {
        if (this.audioElement?.error) {
          console.error("🖥️ [Desktop] Audio error:", this.audioElement.error.code, this.audioElement.error.message);
        }
      };
      this.audioElement.onvolumechange = () => {
        console.log("🖥️ [Desktop] Volume changed:", this.audioElement?.volume, "muted:", this.audioElement?.muted);
      };
    }

    const playPromise = this.audioElement.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log("✅ Audio playback started successfully");
          console.log("📊 Post-play state:", {
            paused: this.audioElement?.paused,
            currentTime: this.audioElement?.currentTime,
            duration: this.audioElement?.duration,
            volume: this.audioElement?.volume,
            muted: this.audioElement?.muted,
          });
        })
        .catch((error) => {
          // NotAllowedError is expected on mobile for first audio (before user interaction)
          if ((error as Error).name === "NotAllowedError") {
            console.log("⚠️ Audio blocked by browser autoplay policy");
            console.log("   This is expected on mobile before user interaction");
            console.log("   Audio will play after user taps/interacts with the page");
          } else {
            // Log other errors for debugging
            console.error("❌ Audio playback failed:", error);
            console.error("   Error name:", (error as Error).name);
            console.error("   Error message:", (error as Error).message);
          }
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
   */
  update(): void {
    const expressionManager = this.vrm.expressionManager;
    if (!expressionManager) {
      return;
    }

    // Use phoneme-timed lip sync if available
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
  private lastMobileLipSyncLog = 0;
  private updateMobileFallbackLipSync(
    expressionManager: NonNullable<VRM["expressionManager"]>
  ): void {
    // Increment timer based on frame rate (~60fps assumed)
    this.mobileAnimationTimer += 0.016;

    // Log periodically to confirm lip sync is running (every 2 seconds)
    const now = Date.now();
    if (now - this.lastMobileLipSyncLog > 2000) {
      this.lastMobileLipSyncLog = now;
      console.log("👄 [Mobile] Fallback lip sync active, timer:", this.mobileAnimationTimer.toFixed(2));
    }

    // Safety timeout: Stop lip sync after 30 seconds max (in case audio never ends)
    // This prevents infinite mouth animation if something goes wrong
    if (this.mobileAnimationTimer > 30) {
      console.log("⏱️ [Mobile] Lip sync timeout reached, stopping");
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

    // Find the current cue and next cue for interpolation
    let currentCue: LipSyncCue | null = null;
    let nextCue: LipSyncCue | null = null;

    for (let i = 0; i < this.lipSyncCues.length; i++) {
      const cue = this.lipSyncCues[i];
      if (currentTime >= cue.start && currentTime < cue.end) {
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

      // Interpolate towards next cue if we're near the end of current cue
      // This creates smoother coarticulation between phonemes
      if (nextCue && currentCue.end - currentTime < 0.05) {
        const blendFactor = 1 - ((currentCue.end - currentTime) / 0.05);
        const { _silence: nextSilence, ...nextPhonemes } = nextCue.phonemes as PhonemeValues & { _silence?: boolean };

        for (const key of ['aa', 'ee', 'ih', 'oh', 'ou'] as const) {
          const nextVal = nextPhonemes[key] ?? 0;
          targetValues[key] = targetValues[key] + (nextVal - targetValues[key]) * blendFactor * 0.5;
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
