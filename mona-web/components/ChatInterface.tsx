"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAudioContext } from "@/hooks/useAudioContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import AvatarStage, { OutfitVisibility, AVATAR_OPTIONS, AvatarId } from "./AvatarStage";
import LoginPrompt from "./LoginPrompt";
import UserMenu from "./UserMenu";
import ProfileModal from "./ProfileModal";
import SettingsModal, { TtsEngine } from "./SettingsModal";
import ShopModal from "./ShopModal";
import { EmotionData, LipSyncCue } from "@/types/chat";
import Image from "next/image";
import { parseTestCommand, triggerPose, returnToRest, triggerExpression, clearExpressions, triggerTestSpeak } from "@/lib/poseCommands";
import { useAnimationState } from "@/hooks/useAnimationState";

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:8000/ws";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function ChatInterface() {
  const [inputValue, setInputValue] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [viewMode, setViewMode] = useState<"portrait" | "full">("full");
  const [selectedImage, setSelectedImage] = useState<{ file: File; preview: string; base64: string } | null>(null);
  const [showOutfitMenu, setShowOutfitMenu] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);
  const [isInitialPrompt, setIsInitialPrompt] = useState(false);
  const [guestLimitInfo, setGuestLimitInfo] = useState<{ messagesUsed: number; messageLimit: number } | null>(null);
  const [volume, setVolume] = useState(1);
  const [ttsEngine, setTtsEngine] = useState<TtsEngine>("sovits");
  const [outfitVisibility, setOutfitVisibility] = useState<OutfitVisibility>({
    shirt: true,
    skirt: true,
    socks: true,
    shoes: true,
    colorVariant: false,
    lingerie: false,
  });
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarId>("moe");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { isAuthenticated, isLoading: isAuthLoading, updateGuestStatus, setGuestLimitReached, resetGuestSession } = useAuth();
  const { isDarkMode, setDarkMode } = useTheme();

  // WebSocket callbacks
  const handleGuestLimitReached = useCallback((messagesUsed: number, messageLimit: number) => {
    setGuestLimitInfo({ messagesUsed, messageLimit });
    setShowLoginPrompt(true);
    setGuestLimitReached(true);
  }, [setGuestLimitReached]);

  const handleAuthStatus = useCallback((status: { guestMessagesRemaining: number | null }) => {
    if (status.guestMessagesRemaining !== null) {
      updateGuestStatus(status.guestMessagesRemaining);
    }
  }, [updateGuestStatus]);

  const { messages, isConnected, isTyping, isGeneratingAudio, latestEmotion, guestMessagesRemaining, sendMessage } = useWebSocket(WEBSOCKET_URL, {
    onGuestLimitReached: handleGuestLimitReached,
    onAuthStatus: handleAuthStatus,
  });
  const { initAudioContext } = useAudioContext();
  const { currentAnimation } = useAnimationState();

  // Get the latest audio URL and lip sync data from Mona's messages
  const latestMonaMessageWithAudio = messages
    .slice()
    .reverse()
    .find((msg) => msg.sender === "mona" && msg.audioUrl);

  const latestAudioUrl = latestMonaMessageWithAudio?.audioUrl;
  const latestLipSync = latestMonaMessageWithAudio?.lipSync;

  useEffect(() => {
    // Log removed("🎵 Latest audio URL updated:", latestAudioUrl);
  }, [latestAudioUrl]);

  // Enable audio on first user interaction
  const enableAudio = async () => {
    try {
      // Initialize AudioContext from user interaction (CRITICAL for mobile)
      await initAudioContext();
      setAudioEnabled(true);
      // Log removed("🔊 Audio enabled by user interaction");
    } catch (error) {
      // Error removed("❌ Failed to enable audio:", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Show login prompt on initial load for non-authenticated users (after auth check completes)
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      setShowLoginPrompt(true);
      setIsInitialPrompt(true);
    }
  }, [isAuthLoading, isAuthenticated]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be less than 10MB');
      return;
    }

    // Create preview URL
    const preview = URL.createObjectURL(file);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedImage({ file, preview, base64 });
    };
    reader.readAsDataURL(file);
  };

  const clearSelectedImage = () => {
    if (selectedImage?.preview) {
      URL.revokeObjectURL(selectedImage.preview);
    }
    setSelectedImage(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioEnabled) enableAudio(); // Enable audio on first interaction

    // Check for test commands (test:crouch, test:lay, test:expr:joy, test:speak, etc.)
    const { command, expressionCommand, speakCommand, speakText, remainingText } = parseTestCommand(inputValue);
    if (command) {
      if (command.type === "play" && command.pose) {
        triggerPose(command.pose);
      } else if (command.type === "stop") {
        returnToRest();
      }
      setInputValue("");
      inputRef.current?.blur();
      return;
    }
    if (expressionCommand) {
      if (expressionCommand.type === "set" && expressionCommand.expression) {
        triggerExpression(expressionCommand.expression, expressionCommand.weight ?? 1.0);
      } else if (expressionCommand.type === "clear") {
        clearExpressions();
      }
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
      sendMessage(inputValue.trim(), selectedImage?.base64, ttsEngine);
      setInputValue("");
      clearSelectedImage();
      // Blur input to close mobile keyboard and reset scroll position
      inputRef.current?.blur();
    }
  };

  const startRecording = async () => {
    if (!audioEnabled) enableAudio(); // Enable audio on first interaction
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      // Error removed('Failed to start recording:', error);
      alert('Microphone access denied. Please allow microphone access to use voice input.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // Create FormData to send audio to backend
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      // Send to backend for transcription
      const response = await fetch(`${BACKEND_URL}/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      const transcribedText = data.text;

      if (transcribedText && transcribedText.trim()) {
        // Set the text in the input field
        setInputValue(transcribedText);

        // Automatically send the message
        if (isConnected) {
          sendMessage(transcribedText.trim(), undefined, ttsEngine);
          setInputValue(''); // Clear after sending
        }
      }
    } catch (error) {
      // Error removed('Transcription failed:', error);
      alert('Failed to transcribe audio. Make sure the backend transcription endpoint is available.');
    } finally {
      setIsProcessing(false);
    }
  };

  const emotionLabel = getEmotionLabel(latestEmotion);

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-900">
      {/* Login prompt modal */}
      <LoginPrompt
        isOpen={showLoginPrompt}
        onClose={() => {
          setShowLoginPrompt(false);
          setIsInitialPrompt(false);
        }}
        onTryForFree={async () => {
          // Reset guest session (start fresh) and enable audio
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

      {/* Audio enablement overlay - shown for authenticated users who haven't enabled audio */}
      {!audioEnabled && isAuthenticated && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer"
          onClick={enableAudio}
        >
          <div className="rounded-3xl border border-white/30 bg-white/95 px-8 py-6 shadow-2xl text-center">
            <svg className="mx-auto h-12 w-12 text-purple-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <h3 className="text-xl font-semibold mb-2">Click to Enable Audio</h3>
            <p className="text-sm text-slate-600">Mona wants to say hello!</p>
          </div>
        </div>
      )}

      {/* Avatar fills the stage */}
      <div className="absolute inset-0">
        <AvatarStage emotion={latestEmotion} audioUrl={audioEnabled ? latestAudioUrl : undefined} lipSync={audioEnabled ? latestLipSync : undefined} viewMode={viewMode} outfitVisibility={outfitVisibility} avatarUrl={AVATAR_OPTIONS.find(a => a.id === selectedAvatar)?.url} />
      </div>

      <div className="relative z-10 flex flex-col pointer-events-none" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}>
        {/* Status */}
        <header className="px-6 pt-4 sm:px-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-3 rounded-full border border-black/60 bg-black/80 px-4 py-2 text-white shadow-2xl pointer-events-auto">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 text-center text-lg font-semibold leading-[40px]">
              M
            </div>
            <div>
              <p className="text-sm font-semibold">Mona</p>
              <p className="text-xs text-white/80">
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    Linked · {emotionLabel}{currentAnimation ? ` · ${formatAnimationName(currentAnimation)}` : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-300">
                    <span className="h-2 w-2 rounded-full bg-red-400" />
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

        {/* Chat panel - extends up from the chat button */}
        {showChat && (
          <div className="absolute right-3 sm:right-6 bottom-24 sm:bottom-28 w-80 sm:w-96 pointer-events-auto">
            <div className="flex max-h-64 sm:max-h-80 flex-col rounded-2xl border border-white/20 bg-white/20 p-3 sm:p-4 shadow-xl backdrop-blur-sm">
              <div className="flex-1 overflow-y-auto overscroll-contain pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400">
                {messages.length === 0 && isConnected && (
                  <div className="py-4 text-center text-slate-500">
                    <p className="text-sm font-medium">Say hi to Mona</p>
                  </div>
                )}

                {messages.map((message, index) => (
                  <ChatMessage key={`${message.timestamp}-${index}`} message={message} />
                ))}

                {isTyping && <TypingIndicator />}

                {isGeneratingAudio && !isTyping && (
                  <div className="flex mb-2 justify-start">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 text-xs">
                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Generating voice...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* Spacer to push input to bottom */}
        <div className="flex-1" />

        {/* Input */}
        <footer className="px-3 sm:px-10 pointer-events-auto" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
            <form onSubmit={handleSubmit} className="flex flex-1 min-w-0 flex-col gap-2 rounded-3xl border border-slate-200 bg-white/90 px-3 sm:px-4 py-2 sm:py-3 shadow-xl">
              {/* Image preview */}
              {selectedImage && (
                <div className="relative inline-block">
                  <Image
                    src={selectedImage.preview}
                    alt="Selected image"
                    width={120}
                    height={120}
                    className="rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearSelectedImage}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              {/* Input row */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Hidden file input */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                {/* Image upload button */}
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={!isConnected || isRecording}
                  className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Upload image"
                >
                  <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                {/* Voice recording button */}
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={!isConnected || isProcessing}
                  className={`flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full transition ${
                    isRecording
                      ? 'animate-pulse bg-red-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                  title={isRecording ? 'Stop recording' : 'Start voice input'}
                >
                  {isProcessing ? (
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onBlur={() => {
                    // Fix iOS Safari keyboard dismiss - reset scroll position
                    setTimeout(() => {
                      window.scrollTo(0, 0);
                    }, 100);
                  }}
                  placeholder={isConnected ? "Send Mona a thought…" : "Connecting to Mona..."}
                  disabled={!isConnected || isRecording}
                  className="min-w-0 flex-1 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!isConnected || (!inputValue.trim() && !selectedImage) || isRecording}
                  className="flex-shrink-0 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 px-2.5 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-pink-500/30 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </form>
            {/* View mode toggle */}
            <button
              type="button"
              onClick={() => setViewMode((prev) => prev === "full" ? "portrait" : "full")}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow"
              title={viewMode === "full" ? "Switch to portrait view" : "Switch to full view"}
            >
              {viewMode === "full" ? (
                // Portrait icon (face/bust)
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="4" strokeWidth={2} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
                </svg>
              ) : (
                // Full body icon
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="2.5" strokeWidth={2} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7.5v5m0 0l-3 4m3-4l3 4m-6-7h6" />
                </svg>
              )}
            </button>
            {/* Outfit toggle button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowOutfitMenu((prev) => !prev)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow"
                title="Outfit options"
              >
                {/* Clothing/hanger icon */}
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l-1 1m1-1l1 1m-1-1v3m0 0l-7 4v10a1 1 0 001 1h12a1 1 0 001-1V10l-7-4z" />
                </svg>
              </button>
              {/* Outfit menu dropdown */}
              {showOutfitMenu && (
                <div className="absolute bottom-12 right-0 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  <p className="px-2 py-1 text-xs font-semibold text-slate-500">Avatar</p>
                  {AVATAR_OPTIONS.map((avatar) => (
                    <label
                      key={avatar.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
                    >
                      <input
                        type="radio"
                        name="avatar"
                        checked={selectedAvatar === avatar.id}
                        onChange={() => setSelectedAvatar(avatar.id)}
                        className="h-4 w-4 border-slate-300 text-purple-500 focus:ring-purple-500"
                      />
                      <span className="text-sm text-slate-700">{avatar.label}</span>
                    </label>
                  ))}
                  <hr className="my-2 border-slate-200" />
                  <p className="px-2 py-1 text-xs font-semibold text-slate-500">Outfit</p>
                  {(["shirt", "skirt", "socks", "shoes"] as const).map((item) => (
                    <label
                      key={item}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
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
                        className="h-4 w-4 rounded border-slate-300 text-purple-500 focus:ring-purple-500"
                      />
                      <span className="text-sm capitalize text-slate-700">{item}</span>
                    </label>
                  ))}
                  <hr className="my-2 border-slate-200" />
                  <p className="px-2 py-1 text-xs font-semibold text-slate-500">Style</p>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={outfitVisibility.colorVariant}
                      onChange={(e) =>
                        setOutfitVisibility((prev) => ({
                          ...prev,
                          colorVariant: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700">Alternate Color</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={outfitVisibility.lingerie}
                      onChange={(e) =>
                        setOutfitVisibility((prev) => ({
                          ...prev,
                          lingerie: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700">Lingerie</span>
                  </label>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (!audioEnabled) enableAudio(); // Enable audio on first interaction
                setShowChat((prev) => !prev);
              }}
              className="flex-shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm sm:px-4 font-semibold text-slate-700 shadow whitespace-nowrap"
            >
              {showChat ? "Hide" : "Chat"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function getEmotionLabel(emotion: EmotionData | null): string {
  if (!emotion || !emotion.emotion || !emotion.intensity) {
    return "Calibrating";
  }
  const toTitle = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  return `${toTitle(emotion.emotion)} · ${toTitle(emotion.intensity)}`;
}

function formatAnimationName(name: string): string {
  // Convert snake_case to Title Case (e.g., "standing_idle" -> "Standing Idle")
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
