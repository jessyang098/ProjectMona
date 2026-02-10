"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/types/chat";

interface FloatingBubblesProps {
  messages: Message[];
  isTyping: boolean;
  isGeneratingAudio: boolean;
}

export default function FloatingBubbles({ messages, isTyping, isGeneratingAudio }: FloatingBubblesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Also scroll when typing/audio indicators appear
  useEffect(() => {
    if ((isTyping || isGeneratingAudio) && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isTyping, isGeneratingAudio]);

  return (
    <div className="mx-auto w-full max-w-2xl px-3 sm:px-8 pointer-events-none">
      {/* Fade mask at the top for older messages */}
      <div className="relative">
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[var(--background)] to-transparent z-10 pointer-events-none dark:from-[#0c0a14]" />

        {/* Scrollable message area */}
        <div
          ref={scrollRef}
          className="max-h-[30vh] overflow-y-auto scrollbar-hide flex flex-col gap-2 pt-8 pb-2"
        >
          {messages.map((msg, i) => {
            const isMona = msg.sender === "mona";
            return (
              <div
                key={`${msg.timestamp}-${i}`}
                className={`pointer-events-auto max-w-[85%] animate-bubbleIn ${
                  isMona ? "self-start" : "self-end"
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg backdrop-blur-xl break-words whitespace-pre-wrap ${
                    isMona
                      ? "glass-bubble-mona border border-pink-200/40 text-slate-800 dark:border-pink-500/30 dark:text-slate-100"
                      : "glass-bubble border border-purple-200/40 text-slate-800 dark:border-purple-500/30 dark:text-slate-100"
                  }`}
                >
                  {msg.content}
                  {isMona && msg.emotion?.emotion && (
                    <span className="ml-2 inline-block rounded-full bg-purple-100/80 px-1.5 py-0.5 text-[10px] font-medium text-purple-600 align-middle dark:bg-purple-900/40 dark:text-purple-400">
                      {msg.emotion.emotion.charAt(0).toUpperCase() + msg.emotion.emotion.slice(1)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isTyping && (
            <div className="self-start max-w-[85%] animate-bubbleIn">
              <div className="glass-bubble-mona rounded-2xl border border-pink-200/40 px-4 py-3 shadow-lg backdrop-blur-xl dark:border-pink-500/30">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-wave rounded-full bg-pink-400" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-wave rounded-full bg-pink-400" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 animate-wave rounded-full bg-pink-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {/* Audio generation indicator */}
          {isGeneratingAudio && !isTyping && (
            <div className="self-start max-w-[85%] animate-bubbleIn">
              <div className="glass-bubble-mona rounded-2xl border border-purple-200/40 px-4 py-3 shadow-lg backdrop-blur-xl dark:border-purple-500/30">
                <div className="flex items-center gap-2 text-xs font-medium text-purple-600 dark:text-purple-400">
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Generating voice...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
