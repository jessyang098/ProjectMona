"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Message } from "@/types/chat";

interface FloatingBubblesProps {
  messages: Message[];
  isTyping: boolean;
  isGeneratingAudio: boolean;
}

interface VisibleBubble {
  id: string;
  message: Message;
  pinned: boolean;
  exiting: boolean;
}

const MAX_BUBBLES = 3;
const AUTO_DISMISS_MS = 8000;

export default function FloatingBubbles({ messages, isTyping, isGeneratingAudio }: FloatingBubblesProps) {
  const [bubbles, setBubbles] = useState<VisibleBubble[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastProcessedRef = useRef(0);

  // Schedule auto-dismiss for a bubble
  const scheduleDismiss = useCallback((id: string) => {
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      setBubbles(prev => prev.map(b =>
        b.id === id && !b.pinned ? { ...b, exiting: true } : b
      ));
      // Remove after exit animation
      setTimeout(() => {
        setBubbles(prev => prev.filter(b => b.id !== id));
        timersRef.current.delete(id);
      }, 400);
    }, AUTO_DISMISS_MS);

    timersRef.current.set(id, timer);
  }, []);

  // Watch for new messages
  useEffect(() => {
    if (messages.length === 0) return;
    if (messages.length <= lastProcessedRef.current) return;

    const newMessages = messages.slice(lastProcessedRef.current);
    lastProcessedRef.current = messages.length;

    newMessages.forEach((msg) => {
      const id = `${msg.timestamp}-${msg.sender}-${Math.random().toString(36).slice(2, 6)}`;
      const bubble: VisibleBubble = { id, message: msg, pinned: false, exiting: false };

      setBubbles(prev => {
        const next = [...prev, bubble];
        // Remove oldest non-pinned if over limit
        while (next.filter(b => !b.exiting).length > MAX_BUBBLES) {
          const oldest = next.find(b => !b.pinned && !b.exiting);
          if (oldest) {
            oldest.exiting = true;
            const timer = timersRef.current.get(oldest.id);
            if (timer) clearTimeout(timer);
            timersRef.current.delete(oldest.id);
          } else break;
        }
        return next;
      });

      scheduleDismiss(id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, scheduleDismiss]);

  // Clean up exiting bubbles
  useEffect(() => {
    const exitingBubbles = bubbles.filter(b => b.exiting);
    if (exitingBubbles.length === 0) return;

    const timer = setTimeout(() => {
      setBubbles(prev => prev.filter(b => !b.exiting));
    }, 400);
    return () => clearTimeout(timer);
  }, [bubbles]);

  // Toggle pin on click
  const handleBubbleClick = useCallback((id: string) => {
    setBubbles(prev => prev.map(b => {
      if (b.id !== id) return b;
      const newPinned = !b.pinned;
      if (newPinned) {
        // Cancel auto-dismiss
        const timer = timersRef.current.get(id);
        if (timer) clearTimeout(timer);
        timersRef.current.delete(id);
      } else {
        // Re-schedule dismiss
        scheduleDismiss(id);
      }
      return { ...b, pinned: newPinned };
    }));
  }, [scheduleDismiss]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return (
    <div className="flex-1 min-h-0 pointer-events-none flex flex-col justify-end px-4 sm:px-8 pb-2 gap-2 overflow-y-auto scrollbar-hide">
      {/* Existing message bubbles */}
      {bubbles.map((bubble) => {
        const isMona = bubble.message.sender === "mona";
        return (
          <div
            key={bubble.id}
            className={`pointer-events-auto max-w-[85%] sm:max-w-[70%] cursor-pointer transition-all duration-300 ${
              isMona ? "self-start" : "self-end"
            } ${bubble.exiting ? "animate-bubbleOut" : "animate-bubbleIn"}`}
            onClick={() => handleBubbleClick(bubble.id)}
          >
            <div
              className={`relative rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg backdrop-blur-xl break-words whitespace-pre-wrap ${
                isMona
                  ? "glass-bubble-mona border border-pink-200/40 text-slate-800 dark:border-pink-500/30 dark:text-slate-100"
                  : "glass-bubble border border-purple-200/40 text-slate-800 dark:border-purple-500/30 dark:text-slate-100"
              } ${bubble.pinned ? "ring-2 ring-pink-400/50" : ""}`}
            >
              {bubble.message.content}
            </div>
          </div>
        );
      })}

      {/* Typing indicator bubble */}
      {isTyping && (
        <div className="self-start max-w-[85%] sm:max-w-[70%] animate-bubbleIn">
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
        <div className="self-start max-w-[85%] sm:max-w-[70%] animate-bubbleIn">
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
  );
}
