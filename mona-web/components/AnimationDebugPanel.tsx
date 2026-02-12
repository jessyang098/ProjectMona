"use client";

export interface AnimationConfig {
  sdk: {
    eyeBlink: boolean;
    breathing: boolean;
    focus: boolean;
    physics: boolean;
  };
  custom: {
    head: boolean;
    bodySway: boolean;
    fidgets: boolean;
    wingFlap: boolean;
    tailWag: boolean;
    eyeGaze: boolean;
    expressions: boolean;
  };
}

export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  sdk: {
    eyeBlink: true,
    breathing: true,
    focus: false,
    physics: true,
  },
  custom: {
    head: true,
    bodySway: true,
    fidgets: true,
    wingFlap: true,
    tailWag: true,
    eyeGaze: true,
    expressions: true,
  },
};

interface AnimationDebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: AnimationConfig;
  onChange: (config: AnimationConfig) => void;
}

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
      <button
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors border ${
          enabled ? "bg-pink-500 border-pink-500" : "bg-slate-200 border-slate-300 dark:bg-slate-600 dark:border-slate-500"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function AnimationDebugPanel({ isOpen, onClose, config, onChange }: AnimationDebugPanelProps) {
  const updateSdk = (key: keyof AnimationConfig["sdk"]) => {
    onChange({ ...config, sdk: { ...config.sdk, [key]: !config.sdk[key] } });
  };

  const updateCustom = (key: keyof AnimationConfig["custom"]) => {
    onChange({ ...config, custom: { ...config.custom, [key]: !config.custom[key] } });
  };

  const allSdkOn = Object.values(config.sdk).every(Boolean);
  const allCustomOn = Object.values(config.custom).every(Boolean);

  const toggleAllSdk = () => {
    const newVal = !allSdkOn;
    onChange({
      ...config,
      sdk: { eyeBlink: newVal, breathing: newVal, focus: newVal, physics: newVal },
    });
  };

  const toggleAllCustom = () => {
    const newVal = !allCustomOn;
    onChange({
      ...config,
      custom: { head: newVal, bodySway: newVal, fidgets: newVal, wingFlap: newVal, tailWag: newVal, eyeGaze: newVal, expressions: newVal },
    });
  };

  return (
    <>
      {/* Toggle button — always visible */}
      <button
        onClick={isOpen ? onClose : undefined}
        className="fixed bottom-24 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600 shadow-lg backdrop-blur-sm hover:bg-white dark:hover:bg-slate-700 transition-colors"
        title="Animation Debug"
        {...(!isOpen && { onClick: () => onChange(config) })}
      >
        <svg className="h-4 w-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Side panel */}
      <div
        className={`fixed top-0 right-0 z-40 h-full w-64 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full overflow-y-auto bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-l border-slate-200 dark:border-slate-600 shadow-2xl p-4 pt-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Animation Debug</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* SDK Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-pink-500">SDK</h4>
              <button
                onClick={toggleAllSdk}
                className="text-[10px] text-slate-400 hover:text-pink-500 transition-colors"
              >
                {allSdkOn ? "disable all" : "enable all"}
              </button>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 px-3 py-1">
              <Toggle label="Eye Blink" enabled={config.sdk.eyeBlink} onToggle={() => updateSdk("eyeBlink")} />
              <Toggle label="Breathing" enabled={config.sdk.breathing} onToggle={() => updateSdk("breathing")} />
              <Toggle label="Focus (Cursor)" enabled={config.sdk.focus} onToggle={() => updateSdk("focus")} />
              <Toggle label="Physics" enabled={config.sdk.physics} onToggle={() => updateSdk("physics")} />
            </div>
          </div>

          {/* Custom Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-500">Custom</h4>
              <button
                onClick={toggleAllCustom}
                className="text-[10px] text-slate-400 hover:text-purple-500 transition-colors"
              >
                {allCustomOn ? "disable all" : "enable all"}
              </button>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 px-3 py-1">
              <Toggle label="Head Movement" enabled={config.custom.head} onToggle={() => updateCustom("head")} />
              <Toggle label="Body Sway" enabled={config.custom.bodySway} onToggle={() => updateCustom("bodySway")} />
              <Toggle label="Fidgets" enabled={config.custom.fidgets} onToggle={() => updateCustom("fidgets")} />
              <Toggle label="Wing Flap" enabled={config.custom.wingFlap} onToggle={() => updateCustom("wingFlap")} />
              <Toggle label="Tail Wag" enabled={config.custom.tailWag} onToggle={() => updateCustom("tailWag")} />
              <Toggle label="Eye Gaze" enabled={config.custom.eyeGaze} onToggle={() => updateCustom("eyeGaze")} />
              <Toggle label="Expressions" enabled={config.custom.expressions} onToggle={() => updateCustom("expressions")} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
