"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface Live2DModel {
  x: number;
  y: number;
  scale: { set: (x: number, y?: number) => void };
  anchor: { set: (x: number, y?: number) => void };
  update: (deltaTime: number) => void;
  destroy: () => void;
  internalModel: {
    coreModel: {
      setParameterValueById: (id: string, value: number) => void;
      getParameterValueById: (id: string) => number;
      getParameterIndex: (id: string) => number;
    };
  };
}

const IDLE_PARAMS = {
  breath: ["ParamBreath", "PARAM_BREATH"],
  eyeLeft: ["ParamEyeLOpen", "PARAM_EYE_L_OPEN"],
  eyeRight: ["ParamEyeROpen", "PARAM_EYE_R_OPEN"],
  angleX: ["ParamAngleX", "PARAM_ANGLE_X"],
  angleY: ["ParamAngleY", "PARAM_ANGLE_Y"],
  angleZ: ["ParamAngleZ", "PARAM_ANGLE_Z"],
  bodyAngleX: ["ParamBodyAngleX", "PARAM_BODY_ANGLE_X"],
  tail: ["Param7"],
  wingFlap: ["headwings"],
  wingToggle: ["headwings2"],
};

function setParam(model: Live2DModel, names: string[], value: number) {
  for (const name of names) {
    const idx = model.internalModel.coreModel.getParameterIndex(name);
    if (idx >= 0) {
      model.internalModel.coreModel.setParameterValueById(name, value);
      return;
    }
  }
}

export default function Live2DHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<any>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const rafRef = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    let destroyed = false;

    async function init() {
      // Dynamic imports — keep landing page bundle small
      const PIXI = await import("pixi.js");
      const { Live2DModel: L2DModel } = await import("pixi-live2d-display");

      if (destroyed) return;

      // Register with PIXI
      (L2DModel as any).registerTicker(PIXI.Ticker);
      (window as any).PIXI = PIXI;

      const container = containerRef.current!;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      const app = new PIXI.Application({
        view: canvasRef.current!,
        width: rect.width,
        height: rect.height,
        backgroundAlpha: 0,
        resolution: dpr,
        autoDensity: true,
        antialias: true,
      });
      appRef.current = app;

      const model = (await (L2DModel as any).from(
        "/avatars/Vena/Vena.model3.json"
      )) as Live2DModel;

      if (destroyed) {
        model.destroy();
        app.destroy(true);
        return;
      }

      modelRef.current = model;

      // Position and scale
      const modelAny = model as any;
      const modelHeight = modelAny.height || 1200;
      const scale = (rect.height * 1.0) / modelHeight;
      model.scale.set(scale);
      model.anchor.set(0.5, 0.5);
      model.x = rect.width / 2;
      model.y = rect.height / 2;

      app.stage.addChild(model as any);

      // Enable wings
      setParam(model, IDLE_PARAMS.wingToggle, 1);

      // Hide watermarks
      const hideWatermarks = () => {
        const watermarks = container.querySelectorAll('[style*="position: absolute"]');
        watermarks.forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.style.zIndex === "9999" || htmlEl.textContent?.includes("Live2D")) {
            htmlEl.style.display = "none";
          }
        });
      };
      const wmInterval = setInterval(hideWatermarks, 500);

      // Idle animation loop
      let lastTime = performance.now();
      let blinkTimer = 3 + Math.random() * 4;

      const animate = (now: number) => {
        if (destroyed) return;
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        const core = model.internalModel.coreModel;
        const t = now / 1000;

        // Breathing
        const breathVal = Math.sin(t * 1.8) * 0.5 + 0.5;
        setParam(model, IDLE_PARAMS.breath, breathVal);

        // Gentle head sway
        setParam(model, IDLE_PARAMS.angleX, Math.sin(t * 0.4) * 5);
        setParam(model, IDLE_PARAMS.angleY, Math.sin(t * 0.3) * 3);
        setParam(model, IDLE_PARAMS.angleZ, Math.sin(t * 0.25) * 2);

        // Body sway
        setParam(model, IDLE_PARAMS.bodyAngleX, Math.sin(t * 0.35) * 2);

        // Tail wag
        setParam(model, IDLE_PARAMS.tail, Math.sin(t * 2.5) * 0.3 + 0.5);

        // Wing flap
        setParam(model, IDLE_PARAMS.wingFlap, Math.sin(t * 1.2) * 0.5 + 0.5);

        // Blinking
        blinkTimer -= dt;
        if (blinkTimer <= 0) {
          blinkTimer = 3 + Math.random() * 5;
        }
        const blinkPhase = blinkTimer < 0.15 ? 0 : 1;
        setParam(model, IDLE_PARAMS.eyeLeft, blinkPhase);
        setParam(model, IDLE_PARAMS.eyeRight, blinkPhase);

        model.update(dt);
        rafRef.current = requestAnimationFrame(animate);
      };

      rafRef.current = requestAnimationFrame(animate);
      setLoaded(true);

      // Cleanup stored for destroy
      (containerRef.current as any).__wmInterval = wmInterval;
    }

    init();

    return () => {
      destroyed = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if ((containerRef.current as any)?.__wmInterval) {
        clearInterval((containerRef.current as any).__wmInterval);
      }
      if (modelRef.current) modelRef.current.destroy();
      if (appRef.current) appRef.current.destroy(true);
      modelRef.current = null;
      appRef.current = null;
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* Static fallback while loading */}
      {!loaded && (
        <Image
          src="/avatars/Vena/1.png"
          alt="Mona - Your AI Companion"
          width={480}
          height={480}
          className="absolute inset-0 m-auto drop-shadow-2xl"
          priority
        />
      )}
      <canvas
        ref={canvasRef}
        className={`w-full h-full transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
