"use client";

import { useState } from "react";

type ShopTab = "characters" | "outfits" | "voices" | "premium";

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Placeholder data - will be replaced with real data from backend
const CHARACTERS = [
  {
    id: "mona",
    name: "Mona",
    description: "Your caring and playful companion who loves getting to know you",
    price: null,
    owned: true,
    gradient: "from-pink-400 via-rose-400 to-purple-500",
  },
  {
    id: "luna",
    name: "Luna",
    description: "Mysterious and thoughtful, with a calm demeanor",
    price: 9.99,
    owned: false,
    comingSoon: true,
    gradient: "from-indigo-400 via-purple-400 to-blue-500",
  },
  {
    id: "aria",
    name: "Aria",
    description: "Energetic and cheerful, always ready to brighten your day",
    price: 9.99,
    owned: false,
    comingSoon: true,
    gradient: "from-amber-400 via-orange-400 to-rose-500",
  },
];

const OUTFITS = [
  {
    id: "default",
    name: "School Uniform",
    description: "Classic and timeless",
    price: null,
    owned: true,
    characterId: "mona",
    color: "bg-slate-100",
  },
  {
    id: "casual",
    name: "Casual Summer",
    description: "Relaxed vibes",
    price: 4.99,
    owned: false,
    characterId: "mona",
    comingSoon: true,
    color: "bg-sky-100",
  },
  {
    id: "formal",
    name: "Elegant Dress",
    description: "Special occasions",
    price: 6.99,
    owned: false,
    characterId: "mona",
    comingSoon: true,
    color: "bg-purple-100",
  },
  {
    id: "cozy",
    name: "Cozy Sweater",
    description: "Warm and comfortable",
    price: 4.99,
    owned: false,
    characterId: "mona",
    comingSoon: true,
    color: "bg-amber-100",
  },
];

const VOICES = [
  {
    id: "default",
    name: "Sweet",
    description: "Mona's signature warm and friendly voice",
    price: null,
    owned: true,
    waveform: [0.3, 0.5, 0.8, 0.6, 0.9, 0.4, 0.7, 0.5, 0.6, 0.8],
  },
  {
    id: "soft",
    name: "Whisper",
    description: "Soft and soothing, perfect for late nights",
    price: 3.99,
    owned: false,
    comingSoon: true,
    waveform: [0.2, 0.3, 0.4, 0.3, 0.5, 0.3, 0.4, 0.3, 0.4, 0.3],
  },
  {
    id: "energetic",
    name: "Cheerful",
    description: "Bright and upbeat energy",
    price: 3.99,
    owned: false,
    comingSoon: true,
    waveform: [0.6, 0.9, 0.7, 0.95, 0.8, 0.9, 0.75, 0.85, 0.9, 0.7],
  },
];

const SUBSCRIPTION = {
  name: "Mona Premium",
  price: 9.99,
  period: "month",
  features: [
    { text: "Unlimited messages", description: "Chat as much as you want" },
    { text: "Memory", description: "Mona remembers your conversations" },
    { text: "Priority voice", description: "Faster, higher quality responses" },
    { text: "Early access", description: "Try new features first" },
    { text: "Exclusive content", description: "Premium outfits and voices" },
  ],
};

export default function ShopModal({ isOpen, onClose }: ShopModalProps) {
  const [activeTab, setActiveTab] = useState<ShopTab>("characters");

  if (!isOpen) return null;

  const tabs: { id: ShopTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "characters",
      label: "Characters",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: "outfits",
      label: "Outfits",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2l-1 1m1-1l1 1m-1-1v3m0 0l-7 4v10a1 1 0 001 1h12a1 1 0 001-1V10l-7-4z" />
        </svg>
      ),
    },
    {
      id: "voices",
      label: "Voices",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      ),
    },
    {
      id: "premium",
      label: "Premium",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] rounded-3xl bg-white shadow-2xl flex flex-col overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <div className="absolute inset-0 bg-gradient-to-b from-pink-50 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Shop</h2>
              <p className="text-sm text-slate-500 mt-0.5">Customize your experience</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="relative mt-6 flex gap-1 rounded-2xl bg-slate-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className={activeTab === tab.id ? "text-pink-500" : ""}>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {activeTab === "characters" && <CharactersTab />}
          {activeTab === "outfits" && <OutfitsTab />}
          {activeTab === "voices" && <VoicesTab />}
          {activeTab === "premium" && <SubscriptionTab />}
        </div>
      </div>
    </div>
  );
}

function CharactersTab() {
  return (
    <div className="space-y-4">
      {CHARACTERS.map((character) => (
        <div
          key={character.id}
          className={`group relative overflow-hidden rounded-2xl border-2 transition-all ${
            character.owned
              ? "border-pink-200 bg-pink-50/50"
              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg"
          }`}
        >
          <div className="flex gap-4 p-4">
            {/* Character Avatar */}
            <div className={`relative h-24 w-24 flex-shrink-0 rounded-2xl bg-gradient-to-br ${character.gradient} shadow-lg`}>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold text-white/90">{character.name.charAt(0)}</span>
              </div>
              {character.owned && (
                <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-green-500 shadow-md ring-2 ring-white">
                  <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {character.comingSoon && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-[2px]">
                  <span className="text-xs font-semibold text-white">Soon</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-1 flex-col justify-center">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-900">{character.name}</h3>
                {character.owned && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500 line-clamp-2">{character.description}</p>

              {/* Action */}
              <div className="mt-3">
                {character.owned ? (
                  <button className="rounded-xl bg-pink-100 px-4 py-2 text-sm font-medium text-pink-600 transition hover:bg-pink-200">
                    Currently Active
                  </button>
                ) : character.comingSoon ? (
                  <button
                    disabled
                    className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
                  >
                    Coming Soon
                  </button>
                ) : (
                  <button className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/25 transition hover:shadow-lg hover:shadow-pink-500/30">
                    Get for ${character.price?.toFixed(2)}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OutfitsTab() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {OUTFITS.map((outfit) => (
        <div
          key={outfit.id}
          className={`group relative overflow-hidden rounded-2xl border-2 transition-all ${
            outfit.owned
              ? "border-pink-200 bg-pink-50/50"
              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg"
          }`}
        >
          {/* Outfit Preview */}
          <div className={`relative aspect-[4/5] ${outfit.color}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="h-16 w-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 2l-1 1m1-1l1 1m-1-1v3m0 0l-7 4v10a1 1 0 001 1h12a1 1 0 001-1V10l-7-4z" />
              </svg>
            </div>

            {outfit.owned && (
              <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 shadow-md">
                <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}

            {outfit.comingSoon && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                  Coming Soon
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-4">
            <h3 className="font-semibold text-slate-900">{outfit.name}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{outfit.description}</p>

            <div className="mt-3">
              {outfit.owned ? (
                <button className="w-full rounded-xl bg-pink-100 py-2 text-sm font-medium text-pink-600 transition hover:bg-pink-200">
                  Equipped
                </button>
              ) : outfit.comingSoon ? (
                <button
                  disabled
                  className="w-full rounded-xl bg-slate-100 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
                >
                  Coming Soon
                </button>
              ) : (
                <button className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/25 transition hover:shadow-lg">
                  ${outfit.price?.toFixed(2)}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function VoicesTab() {
  return (
    <div className="space-y-3">
      {VOICES.map((voice) => (
        <div
          key={voice.id}
          className={`group relative overflow-hidden rounded-2xl border-2 transition-all ${
            voice.owned
              ? "border-pink-200 bg-pink-50/50"
              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg"
          }`}
        >
          <div className="flex items-center gap-4 p-4">
            {/* Waveform visualization */}
            <div className="relative flex h-14 w-14 flex-shrink-0 items-end justify-center gap-0.5 rounded-xl bg-gradient-to-br from-pink-100 to-purple-100 p-2">
              {voice.waveform.map((height, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all ${
                    voice.owned ? "bg-pink-500" : "bg-slate-300"
                  }`}
                  style={{ height: `${height * 100}%` }}
                />
              ))}
              {voice.owned && (
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 shadow ring-2 ring-white">
                  <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">{voice.name}</h3>
                {voice.owned && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-slate-500 truncate">{voice.description}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Preview button */}
              <button
                className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 text-slate-400 transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-500"
                title="Preview voice"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>

              {voice.owned ? (
                <button className="rounded-xl bg-pink-100 px-4 py-2.5 text-sm font-medium text-pink-600 transition hover:bg-pink-200">
                  Active
                </button>
              ) : voice.comingSoon ? (
                <button
                  disabled
                  className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed"
                >
                  Soon
                </button>
              ) : (
                <button className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-pink-500/25 transition hover:shadow-lg">
                  ${voice.price?.toFixed(2)}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SubscriptionTab() {
  return (
    <div className="flex flex-col items-center">
      {/* Premium Card */}
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-800 shadow-2xl">
        {/* Header glow effect */}
        <div className="relative px-6 pt-8 pb-6">
          <div className="absolute inset-0 bg-gradient-to-b from-pink-500/20 to-transparent" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full bg-pink-500/30 blur-3xl" />

          <div className="relative text-center">
            {/* Premium badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/30">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Premium
            </div>

            <h3 className="mt-4 text-2xl font-bold text-white">{SUBSCRIPTION.name}</h3>

            <div className="mt-3 flex items-baseline justify-center gap-1">
              <span className="text-5xl font-bold text-white">${SUBSCRIPTION.price}</span>
              <span className="text-lg text-slate-400">/{SUBSCRIPTION.period}</span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="px-6 pb-8">
          <div className="rounded-2xl bg-white/5 p-4">
            <ul className="space-y-4">
              {SUBSCRIPTION.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-500 shadow-lg shadow-pink-500/30">
                    <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-white">{feature.text}</p>
                    <p className="text-sm text-slate-400">{feature.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Subscribe button */}
          <button className="mt-6 w-full rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 py-4 text-lg font-bold text-white shadow-xl shadow-pink-500/30 transition-all hover:shadow-2xl hover:shadow-pink-500/40 hover:scale-[1.02] active:scale-[0.98]">
            Subscribe Now
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            Cancel anytime. No commitment required.
          </p>
        </div>
      </div>
    </div>
  );
}
