"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAudioContext } from "@/hooks/useAudioContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useAvatarConfig } from "@/hooks/useAvatarConfig";
import { useTTSSettings } from "@/hooks/useTTSSettings";
import { useRecording } from "@/hooks/useRecording";
import { useChatUI } from "@/hooks/useChatUI";
import AvatarStage, { AVATAR_OPTIONS } from "./AvatarStage";
import FloatingBubbles from "./FloatingBubbles";
import ChatHistoryModal from "./ChatHistoryModal";
import ContextMenu from "./ContextMenu";
import LoginPrompt from "./LoginPrompt";
import UserMenu from "./UserMenu";
import ProfileModal from "./ProfileModal";
import SettingsModal from "./SettingsModal";
import ShopModal from "./ShopModal";
import { EmotionData } from "@/types/chat";
import Image from "next/image";
import { parseTestCommand, triggerPose, returnToRest, triggerExpression, clearExpressions, triggerTestSpeak } from "@/lib/poseCommands";
import { useAnimationState } from "@/hooks/useAnimationState";
import { useToast } from "@/contexts/ToastContext";
import ToastContainer from "./Toast";

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:8000/ws";

export default function ChatInterface() {
  const [inputValue, setInputValue] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [viewMode, setViewMode] = useState<"portrait" | "full">("full");
  const [guestLimitInfo, setGuestLimitInfo] = useState<{ messagesUsed: number; messageLimit: number } | null>(null);
  const [volume, setVolume] = useState(1);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef(0);

  const { user, isAuthenticated, isLoading: isAuthLoading, guestSessionId, updateGuestStatus, setGuestLimitReached, resetGuestSession } = useAuth();
  const { isDarkMode, setDarkMode } = useTheme();
  const { show: showToast } = useToast();

  // Custom hooks
  const { selectedImage, imageInputRef, handleImageSelect, clearSelectedImage } = useImageUpload(showToast);
  const { selectedAvatar, setSelectedAvatar, outfitVisibility, setOutfitVisibility, showOutfitMenu, setShowOutfitMenu } = useAvatarConfig();
  const { ttsEngine, setTtsEngine, lipSyncMode, setLipSyncMode, personality, isPersonalitySwitching, handlePersonalityChange } = useTTSSettings(showToast);
  const {
    showHistory, setShowHistory,
    showLoginPrompt, setShowLoginPrompt,
    showProfileModal, setShowProfileModal,
    showSettingsModal, setShowSettingsModal,
    showShopModal, setShowShopModal,
    isInitialPrompt, setIsInitialPrompt,
  } = useChatUI({ isAuthLoading, isAuthenticated });

  // WebSocket callbacks
  const handleGuestLimitReached = useCallback((messagesUsed: number, messageLimit: number) => {
    setGuestLimitInfo({ messagesUsed, messageLimit });
    setShowLoginPrompt(true);
    setGuestLimitReached(true);
  }, [setGuestLimitReached, setShowLoginPrompt]);

  const handleAuthStatus = useCallback((status: { guestMessagesRemaining: number | null; guestMessageLimit: number | null }) => {
    if (status.guestMessagesRemaining !== null) {
      updateGuestStatus(status.guestMessagesRemaining, status.guestMessageLimit ?? undefined);
    }
  }, [updateGuestStatus]);

  const {
    messages,
    isConnected,
    isTyping,
    isGeneratingAudio,
    latestEmotion,
    guestMessagesRemaining,
    connectionError,
    affectionLevel,
    sendMessage,
    audioSegments,
    markSegmentPlaying,
    markSegmentPlayed,
    getNextSegment,
  } = useWebSocket(WEBSOCKET_URL, {
    onGuestLimitReached: handleGuestLimitReached,
    onAuthStatus: handleAuthStatus,
  }, user?.id || guestSessionId || undefined);
  const { initAudioContext } = useAudioContext();
  const { currentAnimation } = useAnimationState();

  // Enable audio on first user interaction
  const enableAudio = useCallback(async () => {
    try {
      await initAudioContext();
      setAudioEnabled(true);
    } catch {
      // Audio init failed silently
    }
  }, [initAudioContext]);

  // Recording hook (depends on enableAudio, sendMessage, etc.)
  const { isRecording, isProcessing, startRecording, stopRecording } = useRecording({
    isConnected,
    sendMessage,
    ttsEngine,
    lipSyncMode,
    enableAudio,
    showToast,
  });

  // Get the latest audio URL and lip sync data
  const currentSegment = getNextSegment();
  const hasAudioSegments = audioSegments.length > 0;

  const latestMonaMessageWithAudio = messages
    .slice()
    .reverse()
    .find((msg) => msg.sender === "mona" && msg.audioUrl);

  const latestAudioUrl = hasAudioSegments && currentSegment
    ? currentSegment.audioUrl
    : latestMonaMessageWithAudio?.audioUrl;
  const latestLipSync = hasAudioSegments && currentSegment
    ? currentSegment.lipSync
    : latestMonaMessageWithAudio?.lipSync;

  const handleAudioEnd = useCallback(() => {
    if (currentSegment) {
      markSegmentPlayed(currentSegment.segmentIndex);
    }
  }, [currentSegment, markSegmentPlayed]);

  // Tap-to-interact handler (rate-limited to 1 per 3 seconds)
  const handleAvatarTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 3000) return;
    lastTapRef.current = now;
    if (!audioEnabled) enableAudio();
    sendMessage("[tap]", undefined, ttsEngine, lipSyncMode);
  }, [audioEnabled, enableAudio, sendMessage, ttsEngine, lipSyncMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioEnabled) enableAudio();

    // Check for test commands
    const { command, expressionCommand, speakCommand, speakText } = parseTestCommand(inputValue);
    if (command) {
      if (command.type === "play" && command.pose) triggerPose(command.pose);
      else if (command.type === "stop") returnToRest();
      setInputValue("");
      inputRef.current?.blur();
      return;
    }
    if (expressionCommand) {
      if (expressionCommand.type === "set" && expressionCommand.expression) triggerExpression(expressionCommand.expression, expressionCommand.weight ?? 1.0);
      else if (expressionCommand.type === "clear") clearExpressions();
      setInputValue("");
      inputRef.current?.blur();
      return;
    }
    if (speakCommand && speakText) {
      triggerTestSpeak(speakText);
      setInputValue("");
      inputRef.current?.blur();
      return;
    }

    if ((inputValue.trim() || selectedImage) && isConnected) {
      sendMessage(inputValue.trim(), selectedImage?.base64, ttsEngine, lipSyncMode);
      setInputValue("");
      clearSelectedImage();
      inputRef.current?.blur();
    }
  };

  // Handle mic/send button — mic when empty, send when has text
  const handleMicOrSend = () => {
    if (inputValue.trim() || selectedImage) {
      // Trigger form submit
      const form = inputRef.current?.closest("form");
      form?.requestSubmit();
    } else {
      // Toggle recording
      if (isRecording) stopRecording();
      else startRecording();
    }
  };

  // Context menu items
  const contextMenuItems = [
    {
      id: "image",
      label: "Photo",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      onClick: () => imageInputRef.current?.click(),
      disabled: !isConnected || isRecording,
    },
    {
      id: "view",
      label: viewMode === "full" ? "Portrait View" : "Full View",
      icon: viewMode === "full" ? (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4" strokeWidth={1.5} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="2.5" strokeWidth={1.5} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7.5v5m0 0l-3 4m3-4l3 4m-6-7h6" />
        </svg>
      ),
      onClick: () => setViewMode(prev => prev === "full" ? "portrait" : "full"),
    },
    {
      id: "outfit",
      label: "Wardrobe",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.5 2L2 7l4.5 1V22h11V8L22 7l-4.5-5h-11z" />
        </svg>
      ),
      onClick: () => setShowOutfitMenu(prev => !prev),
    },
  ];

  // Affection heart icon
  const HeartIcon = () => {
    if (affectionLevel === "devoted") {
      return <svg className="inline h-3.5 w-3.5 text-red-500 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>;
    }
    if (affectionLevel === "close") {
      return <svg className="inline h-3.5 w-3.5 text-pink-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>;
    }
    if (affectionLevel === "warming_up") {
      return <svg className="inline h-3.5 w-3.5 text-pink-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>;
    }
    return <svg className="inline h-3.5 w-3.5 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* Login prompt modal */}
      <LoginPrompt
        isOpen={showLoginPrompt}
        onClose={() => {
          setShowLoginPrompt(false);
          setIsInitialPrompt(false);
        }}
        onTryForFree={async () => {
          resetGuestSession();
          await enableAudio();
          setShowLoginPrompt(false);
          setIsInitialPrompt(false);
        }}
        messagesUsed={guestLimitInfo?.messagesUsed}
        messageLimit={guestLimitInfo?.messageLimit}
        isInitialPrompt={isInitialPrompt}
      />

      {/* Profile modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      {/* Settings modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        volume={volume}
        onVolumeChange={setVolume}
        isDarkMode={isDarkMode}
        onDarkModeChange={setDarkMode}
        ttsEngine={ttsEngine}
        onTtsEngineChange={setTtsEngine}
        lipSyncMode={lipSyncMode}
        onLipSyncModeChange={setLipSyncMode}
        personality={personality}
        onPersonalityChange={handlePersonalityChange}
        isPersonalitySwitching={isPersonalitySwitching}
      />

      {/* Shop modal */}
      <ShopModal
        isOpen={showShopModal}
        onClose={() => setShowShopModal(false)}
        isAuthenticated={isAuthenticated}
        onOpenLogin={() => {
          setShowShopModal(false);
          setShowLoginPrompt(true);
        }}
      />

      {/* Chat history modal */}
      <ChatHistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        messages={messages}
      />

      {/* Audio enablement overlay */}
      {!audioEnabled && isAuthenticated && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer"
          onClick={enableAudio}
        >
          <div className="rounded-3xl border border-slate-200 bg-white/95 px-8 py-6 text-center">
            <svg className="mx-auto h-12 w-12 text-purple-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <h3 className="text-xl font-semibold mb-2">Click to Enable Audio</h3>
            <p className="text-sm text-slate-600">Mona wants to say hello!</p>
          </div>
        </div>
      )}

      {/* Avatar fills the stage */}
      <div className="absolute inset-0">
        <AvatarStage
          emotion={latestEmotion}
          audioUrl={audioEnabled ? latestAudioUrl : undefined}
          lipSync={audioEnabled && lipSyncMode !== "realtime" ? latestLipSync : undefined}
          viewMode={viewMode}
          outfitVisibility={outfitVisibility}
          avatarUrl={AVATAR_OPTIONS.find(a => a.id === selectedAvatar)?.url}
          onAudioEnd={handleAudioEnd}
          lipSyncMode={lipSyncMode}
          isDarkMode={isDarkMode}
          affectionLevel={affectionLevel}
          onTap={handleAvatarTap}
        />
      </div>

      <div className="relative z-10 flex flex-col pointer-events-none" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}>
        {/* Header — minimal status */}
        <header className="px-4 pt-4 sm:px-8 flex items-center justify-between">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-white/50 backdrop-blur-xl border border-slate-300 px-4 py-2.5 text-slate-800 pointer-events-auto animate-fadeIn dark:bg-slate-800/50 dark:border-slate-500 dark:text-slate-100">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">M</span>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Mona</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">Linked</span>
                    <span className="text-slate-400 dark:text-slate-500">·</span>
                    <span title={affectionLevel.replace('_', ' ')}><HeartIcon /></span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    Connecting…
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* User menu / Sign in */}
          <UserMenu
            onOpenLogin={() => setShowLoginPrompt(true)}
            onOpenProfile={() => setShowProfileModal(true)}
            onOpenSettings={() => setShowSettingsModal(true)}
            onOpenShop={() => setShowShopModal(true)}
          />
        </header>

        {/* Connection error — shown inline in header status */}

        {/* Spacer to push bubbles + input to bottom */}
        <div className="flex-1" />

        {/* Floating chat bubbles — directly above input */}
        <FloatingBubbles
          messages={messages}
          isTyping={isTyping}
          isGeneratingAudio={isGeneratingAudio}
        />

        {/* Slim pill input bar */}
        <footer className="px-3 sm:px-8 pointer-events-auto" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
            {/* "+" context menu button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!audioEnabled) enableAudio();
                  setShowContextMenu(prev => !prev);
                }}
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/50 backdrop-blur-xl border border-slate-300 text-slate-600 transition-all duration-200 hover:border-slate-400 hover:text-slate-800 active:scale-95 dark:bg-slate-800/50 dark:border-slate-500 dark:text-slate-300 dark:hover:border-slate-400 dark:hover:text-slate-100 ${showContextMenu ? "rotate-45" : ""}`}
                title="More options"
              >
                <svg className="h-5 w-5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <ContextMenu
                isOpen={showContextMenu}
                onClose={() => setShowContextMenu(false)}
                items={contextMenuItems}
              />
              {/* Outfit menu (opened from context menu) */}
              {showOutfitMenu && (
                <>
                  {/* Backdrop to close on outside click */}
                  <div className="fixed inset-0 z-10" onClick={() => setShowOutfitMenu(false)} />
                  <div className="absolute bottom-14 left-0 w-52 rounded-2xl glass border border-slate-300 p-3 animate-fadeInScale dark:border-slate-500 z-20">
                    {/* Close button */}
                    <div className="flex items-center justify-between mb-1">
                      <p className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider dark:text-slate-500">Avatar</p>
                      <button
                        onClick={() => setShowOutfitMenu(false)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100/60 transition-colors dark:hover:text-slate-200 dark:hover:bg-slate-700/60"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  {AVATAR_OPTIONS.map((avatar) => (
                    <label
                      key={avatar.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-100/60 dark:hover:bg-slate-700/60 transition-colors"
                    >
                      <input
                        type="radio"
                        name="avatar"
                        checked={selectedAvatar === avatar.id}
                        onChange={() => setSelectedAvatar(avatar.id)}
                        className="h-4 w-4 border-slate-300 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 dark:border-slate-500"
                      />
                      <span className="text-sm text-slate-700 font-medium dark:text-slate-200">{avatar.label}</span>
                    </label>
                  ))}
                  <hr className="my-2 border-slate-200/60 dark:border-slate-600/60" />
                  <p className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider dark:text-slate-500">Outfit</p>
                  {(["shirt", "skirt", "socks", "shoes"] as const).map((item) => (
                    <label
                      key={item}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-100/60 dark:hover:bg-slate-700/60 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={outfitVisibility[item]}
                        onChange={(e) =>
                          setOutfitVisibility((prev) => ({
                            ...prev,
                            [item]: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 dark:border-slate-500"
                      />
                      <span className="text-sm capitalize text-slate-700 font-medium dark:text-slate-200">{item}</span>
                    </label>
                  ))}
                  <hr className="my-2 border-slate-200/60 dark:border-slate-600/60" />
                  <p className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider dark:text-slate-500">Style</p>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-100/60 dark:hover:bg-slate-700/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={outfitVisibility.colorVariant}
                      onChange={(e) => setOutfitVisibility((prev) => ({ ...prev, colorVariant: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 dark:border-slate-500"
                    />
                    <span className="text-sm text-slate-700 font-medium dark:text-slate-200">Alternate Color</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-100/60 dark:hover:bg-slate-700/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={outfitVisibility.lingerie}
                      onChange={(e) => setOutfitVisibility((prev) => ({ ...prev, lingerie: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 dark:border-slate-500"
                    />
                    <span className="text-sm text-slate-700 font-medium dark:text-slate-200">Lingerie</span>
                  </label>
                  </div>
                </>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* Main input pill */}
            <form onSubmit={handleSubmit} className="flex flex-1 min-w-0 flex-col gap-1.5 rounded-full bg-white/40 backdrop-blur-xl border border-slate-200/60 px-4 py-1.5 transition-all focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-400/20 dark:bg-slate-800/40 dark:border-slate-600/60 dark:focus-within:border-purple-500 dark:focus-within:ring-purple-500/20">
              {/* Image preview */}
              {selectedImage && (
                <div className="relative inline-block animate-fadeInScale pt-1">
                  <Image
                    src={selectedImage.preview}
                    alt="Selected image"
                    width={80}
                    height={80}
                    className="rounded-lg object-cover border border-slate-200/50"
                  />
                  <button
                    type="button"
                    onClick={clearSelectedImage}
                    className="absolute -right-2 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              {/* Input row */}
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onBlur={() => {
                    setTimeout(() => { window.scrollTo(0, 0); }, 100);
                  }}
                  placeholder={isConnected ? "Talk to Mona…" : "Connecting..."}
                  disabled={!isConnected || isRecording}
                  className="min-w-0 flex-1 bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 text-sm dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                {/* Chat history button */}
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100/60 transition-colors dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-700/60"
                  title="Chat history"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                {/* Send / Mic combo button */}
                <button
                  type={inputValue.trim() || selectedImage ? "submit" : "button"}
                  onClick={!(inputValue.trim() || selectedImage) ? handleMicOrSend : undefined}
                  disabled={!isConnected || isProcessing}
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-95 ${
                    inputValue.trim() || selectedImage
                      ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white"
                      : isRecording
                        ? "animate-pulse bg-red-500 text-white"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                  title={inputValue.trim() || selectedImage ? "Send" : isRecording ? "Stop recording" : "Voice input"}
                >
                  {isProcessing ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : inputValue.trim() || selectedImage ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </div>
        </footer>
      </div>

      <ToastContainer />
    </div>
  );
}
