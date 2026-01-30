"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { EmotionData, LipSyncCue } from "@/types/chat";

// Types from pixi-live2d-display
interface Live2DModel {
  x: number;
  y: number;
  scale: { set: (x: number, y?: number) => void };
  anchor: { set: (x: number, y?: number) => void };
  internalModel: {
    coreModel: {
      setParameterValueById: (id: string, value: number) => void;
      getParameterValueById: (id: string) => number;
      getParameterIndex: (id: string) => number;
    };
    motionManager: {
      startMotion: (group: string, index: number, priority?: number) => Promise<boolean>;
      stopAllMotions: () => void;
    };
  };
  motion: (group: string, index?: number, priority?: number) => Promise<boolean>;
  expression: (name: string) => Promise<boolean>;
  update: (deltaTime: number) => void;
  destroy: () => void;
}

interface Live2DAvatarProps {
  modelUrl: string;
  emotion: EmotionData | null;
  audioUrl?: string | null;
  lipSync?: LipSyncCue[];
}

// Emotion to expression mapping for Live2D models
// Maps our standard emotions to common Live2D expression file names
const EMOTION_TO_EXPRESSION: Record<string, string[]> = {
  // Positive emotions
  happy: ["happy", "smile", "joy", "love"],
  excited: ["happy", "excited", "joy"],
  content: ["relaxed", "happy", "smile"],
  affectionate: ["love", "happy", "smile"],
  playful: ["happy", "playful", "smile"],

  // Neutral/Mixed emotions
  curious: ["neutral", "curious"],
  surprised: ["surprised", "shock"],
  embarrassed: ["red", "embarrassed", "blush"],
  confused: ["confused", "neutral"],
  bored: ["bored", "neutral", "relaxed"],
  neutral: ["neutral"],

  // Negative emotions
  concerned: ["sad", "concerned", "worried"],
  sad: ["sad", "cry", "tearful"],
  annoyed: ["angry", "annoyed", "anger"],
  angry: ["angry", "anger", "mad"],
  frustrated: ["angry", "frustrated", "annoyed"],
};

// Standard Live2D parameter names for lip sync
const LIP_SYNC_PARAMS = {
  mouthOpen: ["ParamMouthOpenY", "PARAM_MOUTH_OPEN_Y", "MouthOpenY"],
  mouthForm: ["ParamMouthForm", "PARAM_MOUTH_FORM", "MouthForm"],
};

// Standard parameters for idle animations
const IDLE_PARAMS = {
  breath: ["ParamBreath", "PARAM_BREATH", "Breath"],
  eyeLeft: ["ParamEyeLOpen", "PARAM_EYE_L_OPEN", "EyeLOpen"],
  eyeRight: ["ParamEyeROpen", "PARAM_EYE_R_OPEN", "EyeROpen"],
  angleX: ["ParamAngleX", "PARAM_ANGLE_X", "AngleX"],
  angleY: ["ParamAngleY", "PARAM_ANGLE_Y", "AngleY"],
  angleZ: ["ParamAngleZ", "PARAM_ANGLE_Z", "AngleZ"],
  bodyAngleX: ["ParamBodyAngleX", "PARAM_BODY_ANGLE_X", "BodyAngleX"],
};

export default function Live2DAvatar({
  modelUrl,
  emotion,
  audioUrl,
  lipSync,
}: Live2DAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const dimensionsRef = useRef({ width: 800, height: 600 });

  // Get actual container dimensions - only for initial size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Only update state if dimensions actually changed significantly
        setDimensions(prev => {
          if (Math.abs(prev.width - rect.width) > 1 || Math.abs(prev.height - rect.height) > 1) {
            const newDims = { width: rect.width, height: rect.height };
            dimensionsRef.current = newDims;
            return newDims;
          }
          return prev;
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const { width, height } = dimensions;

  // Handle resize without destroying the entire app
  useEffect(() => {
    if (!appRef.current || !modelRef.current) return;

    const app = appRef.current;
    const model = modelRef.current;

    // Resize the renderer
    app.renderer.resize(width, height);

    // Reposition and rescale the model
    const modelAny = model as any;
    const modelOriginalHeight = modelAny.height || 1200;
    const scale = (height * 1.3) / modelOriginalHeight;
    model.scale.set(scale);
    model.x = width / 2;
    model.y = height / 2 + height * 0.05;
  }, [width, height]);

  const appRef = useRef<any>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const lipSyncRef = useRef<LipSyncCue[] | undefined>(lipSync);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const timeDomainBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const frequencyBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const prevPhonemeRef = useRef({ aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 });

  // Keep lipSync ref updated
  useEffect(() => {
    lipSyncRef.current = lipSync;
  }, [lipSync]);

  // Animation state
  const animStateRef = useRef({
    breathTimer: 0,
    blinkTimer: 0,
    nextBlinkTime: 2,
    headTimer: 0,
    lastTime: 0,
    isPlaying: false,
  });

  // Find a working parameter name from alternatives
  const findParam = useCallback((model: Live2DModel, alternatives: string[]): string | null => {
    for (const name of alternatives) {
      try {
        const index = model.internalModel.coreModel.getParameterIndex(name);
        if (index >= 0) {
          return name;
        }
      } catch {
        // Parameter doesn't exist, try next
      }
    }
    return null;
  }, []);

  // Set a parameter value safely
  const setParam = useCallback((model: Live2DModel, alternatives: string[], value: number) => {
    const paramName = findParam(model, alternatives);
    if (paramName) {
      try {
        model.internalModel.coreModel.setParameterValueById(paramName, value);
      } catch {
        // Silently fail - parameter might not exist in this model
      }
    }
  }, [findParam]);

  // Map phoneme values to Live2D mouth parameters
  const applyLipSync = useCallback((model: Live2DModel, phonemes: LipSyncCue["phonemes"]) => {
    // Phoneme contributions to mouth opening:
    // aa (ah) = fully open mouth
    // oh/ou = rounded open mouth
    // ee/ih = slightly open, wide mouth

    // Weight phonemes by how much they open the mouth
    const openWeight =
      phonemes.aa * 1.0 +     // "ah" - most open
      phonemes.oh * 0.8 +     // "oh" - rounded open
      phonemes.ou * 0.7 +     // "oo" - rounded, less open
      phonemes.ee * 0.4 +     // "ee" - wide but not very open
      phonemes.ih * 0.3;      // "ih" - minimal opening

    // Clamp to 0-1 range with slight amplification for visibility
    const mouthOpen = Math.min(1, Math.max(0, openWeight));

    // Calculate mouth form (shape): positive = wide, negative = round/puckered
    // ee/ih make the mouth wide (smile-like)
    // oh/ou make the mouth round (pucker-like)
    const wideContribution = phonemes.ee * 0.6 + phonemes.ih * 0.4;
    const roundContribution = phonemes.oh * 0.5 + phonemes.ou * 0.7;
    const mouthForm = wideContribution - roundContribution;

    setParam(model, LIP_SYNC_PARAMS.mouthOpen, mouthOpen);
    setParam(model, LIP_SYNC_PARAMS.mouthForm, mouthForm);
  }, [setParam]);

  // Hide watermark part by index
  const hideWatermark = useCallback((model: Live2DModel) => {
    try {
      // Set parameter to 0 (controls visibility toggle)
      model.internalModel.coreModel.setParameterValueById("Param129", 0);

      // Get the part index for Part84 (watermark) and set opacity to 0
      const coreModel = model.internalModel.coreModel as any;

      // Try different methods to get part index and set opacity
      if (typeof coreModel.getPartIndex === 'function') {
        const partIndex = coreModel.getPartIndex("Part84");
        if (partIndex >= 0) {
          if (typeof coreModel.setPartOpacityByIndex === 'function') {
            coreModel.setPartOpacityByIndex(partIndex, 0);
          } else if (coreModel._partOpacities && Array.isArray(coreModel._partOpacities)) {
            coreModel._partOpacities[partIndex] = 0;
          }
        }
      }

      // Also try through the model's parts array if available
      if (coreModel._model && coreModel._model.parts) {
        const parts = coreModel._model.parts;
        for (let i = 0; i < parts.count; i++) {
          const partId = parts.ids[i];
          if (partId === "Part84") {
            if (typeof parts.opacities !== 'undefined') {
              parts.opacities[i] = 0;
            }
            break;
          }
        }
      }
    } catch {
      // Ignore errors - watermark hiding is best-effort
    }
  }, []);

  // Update idle animations (breathing, blinking, subtle head movement)
  const updateIdleAnimations = useCallback((model: Live2DModel, delta: number) => {
    const state = animStateRef.current;

    // Keep watermark hidden every frame
    hideWatermark(model);

    // Breathing animation
    state.breathTimer += delta;
    const breathValue = (Math.sin(state.breathTimer * 2) + 1) * 0.5;
    setParam(model, IDLE_PARAMS.breath, breathValue);

    // Blinking animation
    state.blinkTimer += delta;
    if (state.blinkTimer >= state.nextBlinkTime) {
      state.blinkTimer = 0;
      state.nextBlinkTime = 2 + Math.random() * 3; // Random interval 2-5 seconds

      // Quick blink animation
      const blinkDuration = 0.15;
      let blinkProgress = 0;
      const blinkInterval = setInterval(() => {
        blinkProgress += 0.016;
        const t = blinkProgress / blinkDuration;
        // Ease in-out for natural blink
        const eyeOpen = t < 0.5
          ? 1 - 4 * t * t
          : 4 * (t - 1) * (t - 1) - 1 + 2;
        setParam(model, IDLE_PARAMS.eyeLeft, Math.max(0, eyeOpen));
        setParam(model, IDLE_PARAMS.eyeRight, Math.max(0, eyeOpen));

        if (blinkProgress >= blinkDuration) {
          clearInterval(blinkInterval);
          setParam(model, IDLE_PARAMS.eyeLeft, 1);
          setParam(model, IDLE_PARAMS.eyeRight, 1);
        }
      }, 16);
    }

    // Subtle head movement
    state.headTimer += delta;
    const headX = Math.sin(state.headTimer * 0.5) * 3;
    const headY = Math.sin(state.headTimer * 0.3) * 2;
    const headZ = Math.sin(state.headTimer * 0.4) * 2;
    setParam(model, IDLE_PARAMS.angleX, headX);
    setParam(model, IDLE_PARAMS.angleY, headY);
    setParam(model, IDLE_PARAMS.angleZ, headZ);

    // Subtle body sway
    const bodyX = Math.sin(state.headTimer * 0.2) * 2;
    setParam(model, IDLE_PARAMS.bodyAngleX, bodyX);
  }, [setParam]);

  // Initialize PixiJS and Live2D
  useEffect(() => {
    if (!canvasRef.current) return;

    let mounted = true;

    // Load Cubism 4 SDK from CDN (required for moc3 files)
    const loadCubismSDK = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if ((window as any).Live2DCubismCore) {
          resolve();
          return;
        }

        const script = document.createElement("script");
        script.src = "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js";
        script.onload = () => {
          // Log removed("✅ Cubism 4 SDK loaded");
          resolve();
        };
        script.onerror = () => reject(new Error("Failed to load Cubism SDK"));
        document.head.appendChild(script);
      });
    };

    const initLive2D = async () => {
      try {
        // Load Cubism SDK first (required by pixi-live2d-display)
        await loadCubismSDK();

        // Dynamic imports for PixiJS and Live2D (cubism4 build for moc3 support)
        const PIXI = await import("pixi.js");
        const { Live2DModel: Live2DModelClass } = await import("pixi-live2d-display/cubism4");

        // Register Live2D with PixiJS ticker (v6 API)
        (Live2DModelClass as any).registerTicker(PIXI.Ticker);

        if (!mounted || !canvasRef.current) return;

        // Get current dimensions from ref (fresher than closure)
        const initWidth = dimensionsRef.current.width;
        const initHeight = dimensionsRef.current.height;

        // Create PixiJS application (v6 API - synchronous constructor)
        const app = new PIXI.Application({
          view: canvasRef.current,
          width: initWidth,
          height: initHeight,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        if (!mounted) {
          app.destroy();
          return;
        }

        appRef.current = app;

        // Load the Live2D model
        // Log removed("🎭 Loading Live2D model from:", modelUrl);
        const model = await Live2DModelClass.from(modelUrl) as unknown as Live2DModel;

        if (!mounted) {
          model.destroy();
          app.destroy();
          return;
        }

        // Scale to fit canvas height (larger)
        const modelAny = model as any;
        const modelOriginalHeight = modelAny.height || 1200;
        const scale = (initHeight * 1.3) / modelOriginalHeight;
        model.scale.set(scale);

        // Position model - anchor at center, shift down slightly
        model.anchor.set(0.5, 0.5);
        model.x = initWidth / 2;
        model.y = initHeight / 2 + initHeight * 0.05; // Shift down 5%

        // Enable dragging for position adjustment
        modelAny.interactive = true;
        modelAny.buttonMode = true;

        let dragging = false;
        let dragOffset = { x: 0, y: 0 };

        modelAny.on('pointerdown', (event: any) => {
          dragging = true;
          const pos = event.data.global;
          dragOffset.x = pos.x - model.x;
          dragOffset.y = pos.y - model.y;
        });

        modelAny.on('pointermove', (event: any) => {
          if (dragging) {
            const pos = event.data.global;
            model.x = pos.x - dragOffset.x;
            model.y = pos.y - dragOffset.y;
          }
        });

        modelAny.on('pointerup', () => {
          if (dragging) {
            dragging = false;
          }
        });

        modelAny.on('pointerupoutside', () => {
          if (dragging) {
            dragging = false;
          }
        });

        app.stage.addChild(model as any);
        modelRef.current = model;

        // Hide watermark on initial load
        hideWatermark(model);
        // Log removed("✅ Watermark hiding initialized");

        // Verify lip sync parameters exist
        const mouthOpenParam = findParam(model, LIP_SYNC_PARAMS.mouthOpen);
        const mouthFormParam = findParam(model, LIP_SYNC_PARAMS.mouthForm);

        // Start animation loop
        animStateRef.current.lastTime = performance.now();
        const animate = () => {
          if (!mounted || !modelRef.current) return;

          const now = performance.now();
          const delta = (now - animStateRef.current.lastTime) / 1000;
          animStateRef.current.lastTime = now;

          // Update idle animations
          updateIdleAnimations(modelRef.current, delta);

          // Update lip sync if audio is playing
          if (audioRef.current && !audioRef.current.paused) {
            const currentTime = audioRef.current.currentTime;
            const audioDuration = audioRef.current.duration;

            if (lipSyncRef.current && lipSyncRef.current.length > 0) {
              // Timed lip sync from backend
              if (currentTime < audioDuration - 0.1) {
                const cue = lipSyncRef.current.find(c => currentTime >= c.start && currentTime < c.end);
                if (cue) {
                  applyLipSync(modelRef.current, cue.phonemes);
                } else {
                  applyLipSync(modelRef.current, { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 });
                }
              } else {
                applyLipSync(modelRef.current, { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 });
              }
            } else if (analyserRef.current && timeDomainBufferRef.current && frequencyBufferRef.current) {
              // Real-time audio analysis fallback
              analyserRef.current.getByteTimeDomainData(timeDomainBufferRef.current);
              analyserRef.current.getByteFrequencyData(frequencyBufferRef.current);

              // RMS amplitude
              let sumSquares = 0;
              for (let i = 0; i < timeDomainBufferRef.current.length; i++) {
                const n = (timeDomainBufferRef.current[i] - 128) / 128;
                sumSquares += n * n;
              }
              const amplitude = Math.sqrt(sumSquares / timeDomainBufferRef.current.length);

              // Spectral centroid
              let weightedSum = 0, magSum = 0;
              for (let i = 0; i < frequencyBufferRef.current.length; i++) {
                const mag = frequencyBufferRef.current[i];
                weightedSum += i * mag;
                magSum += mag;
              }
              const centroid = magSum > 0 ? weightedSum / magSum / frequencyBufferRef.current.length : 0;

              // Map to phonemes
              const threshold = 0.0005;
              const phonemes = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
              if (amplitude > threshold) {
                const level = Math.min(0.8, (amplitude - threshold) * 12);
                phonemes.aa = level;
                if (centroid > 0.45) phonemes.ee = level * 0.7;
                else if (centroid > 0.35) phonemes.ih = level * 0.8;
                else if (centroid > 0.25) phonemes.oh = level * 0.9;
                else phonemes.ou = level;
              }

              // Smooth
              const smooth = 0.2;
              const prev = prevPhonemeRef.current;
              const smoothed = {
                aa: prev.aa + smooth * (phonemes.aa - prev.aa),
                ee: prev.ee + smooth * (phonemes.ee - prev.ee),
                ih: prev.ih + smooth * (phonemes.ih - prev.ih),
                oh: prev.oh + smooth * (phonemes.oh - prev.oh),
                ou: prev.ou + smooth * (phonemes.ou - prev.ou),
              };
              prevPhonemeRef.current = smoothed;
              applyLipSync(modelRef.current, smoothed);
            }
          }

          animationFrameRef.current = requestAnimationFrame(animate);
        };
        animate();

      } catch (error) {
        // Error removed("❌ Failed to load Live2D model:", error);
      }
    };

    initLive2D();

    return () => {
      mounted = false;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (modelRef.current) {
        modelRef.current.destroy();
        modelRef.current = null;
      }

      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [modelUrl, updateIdleAnimations, applyLipSync, hideWatermark]);

  // Handle emotion changes
  useEffect(() => {
    if (!modelRef.current || !emotion) return;

    const expressionCandidates = EMOTION_TO_EXPRESSION[emotion.emotion] || ["neutral"];

    // Try each candidate expression until one works
    const tryExpression = async (index: number) => {
      if (index >= expressionCandidates.length || !modelRef.current) return;

      try {
        const expressionName = expressionCandidates[index];
        const success = await modelRef.current.expression(expressionName);
        if (success) {
          // Log removed(`😊 Live2D expression set: ${expressionName}`);
        } else {
          // Try next candidate
          tryExpression(index + 1);
        }
      } catch {
        // Expression doesn't exist, try next
        tryExpression(index + 1);
      }
    };

    tryExpression(0);
  }, [emotion]);

  // Handle audio playback
  useEffect(() => {
    if (!audioUrl || audioUrl === currentAudioUrlRef.current) return;

    currentAudioUrlRef.current = audioUrl;

    // Track if this effect is still active
    let isActive = true;

    // Stop any current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    // Create new audio element
    const audio = new Audio(audioUrl);
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audioRef.current = audio;

    // Set up Web Audio API analyser for real-time lip sync fallback
    const hasLipSyncData = lipSyncRef.current && lipSyncRef.current.length > 0;
    if (!hasLipSyncData) {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === "suspended") {
          ctx.resume();
        }
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;
        timeDomainBufferRef.current = new Uint8Array(analyser.fftSize);
        frequencyBufferRef.current = new Uint8Array(analyser.frequencyBinCount);

        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        sourceRef.current = source;
      } catch {
        // Web Audio API not available, lip sync will be skipped
      }
    }

    audio.onended = () => {
      animStateRef.current.isPlaying = false;
      prevPhonemeRef.current = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
      // Close mouth when audio ends
      if (modelRef.current) {
        applyLipSync(modelRef.current, { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 });
      }
    };

    audio.onerror = (e) => {
      // Ignore abort errors that happen during cleanup
      if (audio.error?.code !== MediaError.MEDIA_ERR_ABORTED) {
        // Error removed("❌ Live2D audio error:", e);
      }
    };

    // Wait for audio to be ready before playing
    audio.oncanplaythrough = () => {
      if (!isActive) return;

      // Start playback
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          if (isActive) {
            animStateRef.current.isPlaying = true;
            // Log removed("▶️ Live2D audio playing");
          }
        }).catch((error) => {
          // Ignore abort errors from cleanup
          if (error.name !== "AbortError") {
            // Error removed("❌ Live2D audio playback failed:", error);
          }
        });
      }
    };

    return () => {
      isActive = false;
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.oncanplaythrough = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current = null;
      }
    };
  }, [audioUrl, applyLipSync]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden", // Clip any content outside bounds (hides foot watermark)
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  );
}
