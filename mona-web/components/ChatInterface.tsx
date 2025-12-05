"use client";

import { useState, useRef, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import AvatarStage from "./AvatarStage";
import { EmotionData } from "@/types/chat";

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:8000/ws";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function ChatInterface() {
  const [inputValue, setInputValue] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { messages, isConnected, isTyping, latestEmotion, sendMessage} = useWebSocket(WEBSOCKET_URL);

  // Get the latest audio URL from Mona's messages
  const latestAudioUrl = messages
    .slice()
    .reverse()
    .find((msg) => msg.sender === "mona" && msg.audioUrl)?.audioUrl;

  useEffect(() => {
    console.log("🎵 Latest audio URL updated:", latestAudioUrl);
  }, [latestAudioUrl]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && isConnected) {
      sendMessage(inputValue.trim());
      setInputValue("");
      inputRef.current?.focus();
    }
  };

  const startRecording = async () => {
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
      console.error('Failed to start recording:', error);
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
          sendMessage(transcribedText.trim());
          setInputValue(''); // Clear after sending
        }
      }
    } catch (error) {
      console.error('Transcription failed:', error);
      alert('Failed to transcribe audio. Make sure the backend transcription endpoint is available.');
    } finally {
      setIsProcessing(false);
    }
  };

  const emotionLabel = getEmotionLabel(latestEmotion);

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-900">
      {/* Avatar fills the stage */}
      <div className="absolute inset-0">
        <AvatarStage emotion={latestEmotion} audioUrl={latestAudioUrl} />
      </div>

      <div className="relative z-10 flex h-screen flex-col">
        {/* Status */}
        <header className="px-6 pt-6 sm:px-10">
          <div className="inline-flex items-center gap-3 rounded-full border border-black/60 bg-black/80 px-4 py-2 text-white shadow-2xl">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 text-center text-lg font-semibold leading-[40px]">
              M
            </div>
            <div>
              <p className="text-sm font-semibold">Mona</p>
              <p className="text-xs text-white/80">
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    Linked · {emotionLabel}
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
        </header>

        {/* Conversation overlay */}
        {showChat ? (
          <main className="flex-1 overflow-hidden px-4 py-4 sm:px-10">
            <div className="flex h-full w-full justify-end">
              <div className="flex h-full w-full max-w-2xl flex-col rounded-3xl border border-white/60 bg-white/90 p-6 shadow-2xl backdrop-blur-md">
                <div className="flex-1 overflow-y-auto overscroll-contain pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400">
                  {messages.length === 0 && isConnected && (
                    <div className="mt-32 text-center text-slate-500">
                      <p className="text-xl font-semibold">Say hi to Mona</p>
                      <p className="text-sm">Her mood + aura will react in real time.</p>
                    </div>
                  )}

                  {messages.map((message, index) => (
                    <ChatMessage key={`${message.timestamp}-${index}`} message={message} />
                  ))}

                  {isTyping && <TypingIndicator />}

                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>
          </main>
        ) : (
          <div className="flex-1" />
        )}

        {/* Input */}
        <footer className="px-4 pb-8 sm:px-10">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
            <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-3 rounded-full border border-slate-200 bg-white/90 px-4 py-3 shadow-xl">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!isConnected || isProcessing}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                  isRecording
                    ? 'animate-pulse bg-red-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title={isRecording ? 'Stop recording' : 'Start voice input'}
              >
                {isProcessing ? (
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isConnected ? "Send Mona a thought…" : "Connecting to Mona..."}
                disabled={!isConnected || isRecording}
                className="flex-1 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!isConnected || !inputValue.trim() || isRecording}
                className="rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </form>
            <button
              type="button"
              onClick={() => setShowChat((prev) => !prev)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow"
            >
              {showChat ? "Hide Chat" : "Show Chat"}
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
