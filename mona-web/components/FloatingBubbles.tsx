"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Message } from "@/types/chat";

interface FloatingBubblesProps {
  messages: Message[];
  isTyping: boolean;
  isGeneratingAudio: boolean;
}

interface VisibleBubble {
  id: string;
  message: Message;
  state: "entering" | "visible" | "exiting";
}

const BUBBLE_LIFETIME_MS = 6000; // How long a bubble stays before floating away
const MAX_VISIBLE = 4;

export default function FloatingBubbles({ messages, isTyping, isGeneratingAudio }: FloatingBubblesProps) {
  const [bubbles, setBubbles] = useState<VisibleBubble[]>([]);
  const prevCountRef = useRef(0);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeBubble = useCallback((id: string) => {
    // Start exit animation
    setBubbles((prev) => prev.map((b) => (b.id === id ? { ...b, state: "exiting" as const } : b)));
    // Remove from DOM after animation
    setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => b.id !== id));
    }, 800);
  }, []);

  const scheduleDismiss = useCallback(
    (id: string) => {
      const timer = setTimeout(() => {
        removeBubble(id);
        timersRef.current.delete(id);
      }, BUBBLE_LIFETIME_MS);
      timersRef.current.set(id, timer);
    },
    [removeBubble]
  );

  // Watch for new messages
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const newMessages = messages.slice(prevCountRef.current);
      const now = Date.now();

      // Generate IDs upfront so they match between state update and timer scheduling
      const newIds = newMessages.map((_, i) => `${now}-${prevCountRef.current + i}`);

      setBubbles((prev) => {
        const newBubbles: VisibleBubble[] = newMessages.map((msg, i) => ({
          id: newIds[i],
          message: msg,
          state: "entering" as const,
        }));

        // Combine and keep only last MAX_VISIBLE
        const combined = [...prev, ...newBubbles];
        if (combined.length > MAX_VISIBLE) {
          const excess = combined.slice(0, combined.length - MAX_VISIBLE);
          excess.forEach((b) => {
            const timer = timersRef.current.get(b.id);
            if (timer) {
              clearTimeout(timer);
              timersRef.current.delete(b.id);
            }
          });
          return combined.slice(-MAX_VISIBLE);
        }
        return combined;
      });

      // Schedule dismiss for new messages
      newIds.forEach((id) => scheduleDismiss(id));

      // Transition entering → visible after animation
      setTimeout(() => {
        setBubbles((prev) => prev.map((b) => (b.state === "entering" ? { ...b, state: "visible" } : b)));
      }, 350);
    }
    prevCountRef.current = messages.length;
  }, [messages.length, scheduleDismiss]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-3 sm:px-8 pointer-events-none">
      <div className="flex flex-col gap-2 pb-2">
        {bubbles.map((bubble) => {
          const isMona = bubble.message.sender === "mona";
          const isExiting = bubble.state === "exiting";
          const isEntering = bubble.state === "entering";

          return (
            <div
              key={bubble.id}
              className={`pointer-events-auto max-w-[85%] ${
                isMona ? "self-start" : "self-end"
              } ${isEntering ? "animate-bubbleIn" : ""} ${isExiting ? "animate-bubbleFloat" : ""}`}
              style={{
                transition: "opacity 0.3s ease, transform 0.3s ease",
              }}
            >
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg backdrop-blur-xl break-words whitespace-pre-wrap ${
                  isMona
                    ? "glass-bubble-mona border border-pink-200/40 text-slate-800 dark:border-pink-500/30 dark:text-slate-100"
                    : "glass-bubble border border-purple-200/40 text-slate-800 dark:border-purple-500/30 dark:text-slate-100"
                }`}
              >
                {bubble.message.content}
                {isMona && bubble.message.emotion?.emotion && (
                  <span className="ml-2 inline-block rounded-full bg-purple-100/80 px-1.5 py-0.5 text-[10px] font-medium text-purple-600 align-middle dark:bg-purple-900/40 dark:text-purple-400">
                    {bubble.message.emotion.emotion.charAt(0).toUpperCase() + bubble.message.emotion.emotion.slice(1)}
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
  );
}
