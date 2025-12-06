import { VRM } from "@pixiv/three-vrm";

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
  /** Spectral centroid thresholds for phoneme classification */
  centroidThresholds: {
    wide: number; // ee sound
    ih: number; // ih sound
    oh: number; // oh sound
  };
}

const DEFAULT_CONFIG: LipSyncConfig = {
  smoothingFactor: 0.15, // Faster response to changes
  amplitudeThreshold: 0.001, // Lowered to trigger on quieter sounds
  amplitudeScale: 15.0, // Significantly increased for more visible mouth movement
  centroidThresholds: {
    wide: 0.65, // Adjusted for better vowel detection
    ih: 0.45,
    oh: 0.25,
  },
};

type PhonemeValues = {
  aa: number;
  ee: number;
  ih: number;
  oh: number;
  ou: number;
};

/**
 * Manages real-time lip sync animation based on audio analysis.
 * Uses amplitude and spectral centroid to estimate phoneme shapes.
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
   * Initialize audio analysis for the given audio URL.
   * MOBILE FIX: Creates audio element synchronously to preserve user interaction context.
   * Audio loading happens asynchronously in the background.
   */
  setupAudio(audioUrl: string): void {
    console.log("🎵 LipSyncManager.setupAudio called with:", audioUrl);
    console.log("🎵 Full audio URL that will be loaded:", new URL(audioUrl, window.location.href).href);

    // CRITICAL: Clean up old audio element and source before creating new ones
    if (this.audioElement) {
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
    this.audioElement = new Audio(audioUrl);
    this.audioElement.crossOrigin = "anonymous";

    console.log("🎵 Audio element src set to:", this.audioElement.src);

    // Mobile-specific attributes for better compatibility
    if (this.isMobile) {
      this.audioElement.setAttribute("playsinline", "true");
      this.audioElement.setAttribute("webkit-playsinline", "true");
      this.audioElement.preload = "auto";
      console.log("📱 Mobile audio attributes applied");
    }

    console.log("🎵 Audio element created");

    // Setup event listeners (these fire asynchronously but don't block play())
    this.audioElement.oncanplaythrough = () => {
      console.log("✅ Audio can play through");
    };

    this.audioElement.onerror = (error) => {
      // Network state 2 (NETWORK_IDLE) with no error often happens when browser aborts loading
      // This can be normal during rapid audio switching - only log if there's an actual error
      if (this.audioElement?.error) {
        const mediaError = this.audioElement.error;
        console.error("❌ Audio loading failed - MediaError code:", mediaError.code);
        console.error("   Message:", mediaError.message);
        console.error("   Codes: 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED");
      } else if (this.audioElement?.networkState !== 2) {
        // Only log if it's not the common NETWORK_IDLE state
        console.warn("⚠️ Audio error (no MediaError):", {
          networkState: this.audioElement?.networkState,
          readyState: this.audioElement?.readyState,
        });
      }
    };

    // Load audio asynchronously (doesn't block play())
    console.log("🎵 Loading audio...");
    this.audioElement.load();

    // Setup Web Audio API analysis chain
    console.log("🎵 Setting up Web Audio API...");

    // Use global AudioContext if available (initialized from user interaction)
    if (!this.audioContext) {
      this.audioContext = (window as any).__monaAudioContext;
      if (this.audioContext) {
        console.log("✅ Using pre-initialized global AudioContext");
      } else {
        console.warn("⚠️ No global AudioContext found! This may fail on mobile.");
        // Create it anyway, but this might fail on mobile
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log("⚠️ AudioContext created without user interaction (may fail on mobile)");
      }
    }

    console.log("🎵 AudioContext state:", this.audioContext.state);

    try {
      // Create new MediaElementSource for this audio element
      // Note: Each audio element needs its own source
      this.source = this.audioContext.createMediaElementSource(this.audioElement);

      // Create analyser if we don't have one, or reuse existing
      if (!this.analyser) {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.timeDomainBuffer = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
        this.frequencyBuffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      }

      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      console.log("✅ Web Audio API setup complete");
    } catch (error) {
      console.error("❌ Failed to set up Web Audio API:", error);
      console.error("   This usually happens on mobile when AudioContext wasn't initialized from user interaction");
      throw error;
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

    // Log detailed audio element state
    console.log("📊 Audio element state:", {
      src: this.audioElement.src,
      readyState: this.audioElement.readyState,
      paused: this.audioElement.paused,
      currentTime: this.audioElement.currentTime,
      duration: this.audioElement.duration,
      volume: this.audioElement.volume,
      muted: this.audioElement.muted,
    });

    // Resume AudioContext if needed (must be sync for mobile)
    if (this.audioContext?.state === "suspended") {
      console.log("🎵 Resuming suspended AudioContext synchronously...");
      this.audioContext.resume().catch((error) => {
        console.error("❌ Failed to resume AudioContext:", error);
      });
    }

    // CRITICAL: Call play() synchronously to preserve user interaction context
    console.log("▶️ Calling audioElement.play() synchronously...");
    const playPromise = this.audioElement.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log("✅ Audio playback started successfully");
        })
        .catch((error) => {
          // NotAllowedError is expected on mobile for first audio (before user interaction)
          // Silently skip it - subsequent audio after user interaction will work
          if ((error as Error).name === "NotAllowedError") {
            console.log("ℹ️ Audio blocked by browser (expected on first load before user interaction)");
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
   */
  stop(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    this.resetMouth();
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
    if (!this.analyser || !this.timeDomainBuffer || !this.frequencyBuffer) {
      return;
    }

    const expressionManager = this.vrm.expressionManager;
    if (!expressionManager) {
      console.warn("⚠️ No expressionManager on VRM, cannot update lip sync");
      return;
    }

    // Debug: Log available expressions on first update
    if (!this.previousPhonemeValues.aa) {
      const availableExpressions = (expressionManager as any).expressionMap
        ? Object.keys((expressionManager as any).expressionMap)
        : "unknown";
      console.log("📋 Available VRM expressions:", availableExpressions);
    }

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
    const { amplitudeThreshold, amplitudeScale, centroidThresholds } = this.config;
    const phonemes: PhonemeValues = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };

    if (amplitude > amplitudeThreshold) {
      const intensity = Math.min(1, (amplitude - amplitudeThreshold) * amplitudeScale);

      // Classify by spectral brightness with more nuanced blending
      if (centroid > centroidThresholds.wide) {
        // Bright, wide vowel (ee) - like "see", "tree"
        phonemes.ee = intensity * 0.8;
        phonemes.aa = intensity * 0.3; // Small mouth opening
      } else if (centroid > centroidThresholds.ih) {
        // Mid-range vowel (ih) - like "sit", "bit"
        phonemes.ih = intensity * 0.7;
        phonemes.aa = intensity * 0.5; // Medium mouth opening
      } else if (centroid > centroidThresholds.oh) {
        // Darker vowel (oh) - like "go", "no"
        phonemes.oh = intensity * 0.8;
        phonemes.aa = intensity * 0.6; // Wider mouth opening
      } else {
        // Darkest vowel (ou) - like "you", "blue"
        phonemes.ou = intensity * 0.9;
        phonemes.aa = intensity * 0.4; // Rounded mouth
      }
    }

    return phonemes;
  }

  /**
   * Apply smoothed phoneme values to VRM expression manager
   */
  private applySmoothedPhonemes(
    targetValues: PhonemeValues,
    expressionManager: NonNullable<VRM["expressionManager"]>
  ): void {
    const { smoothingFactor } = this.config;

    for (const phoneme of Object.keys(targetValues) as (keyof PhonemeValues)[]) {
      const target = targetValues[phoneme];
      const previous = this.previousPhonemeValues[phoneme];

      // Exponential smoothing
      const smoothed = previous + smoothingFactor * (target - previous);
      this.previousPhonemeValues[phoneme] = smoothed;

      expressionManager.setValue(phoneme, smoothed);
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.audioElement?.pause();
    this.audioElement = null;

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
