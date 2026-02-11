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
  messageIndex: number; // Index into messages array — always reads latest content
  state: "entering" | "visible" | "exiting";
}

const BUBBLE_LIFETIME_MS = 6000; // How long a bubble stays before floating away
const MAX_VISIBLE = 4;

export default function FloatingBubbles({ messages, isTyping, isGeneratingAudio }: FloatingBubblesProps) {
  const [bubbles, setBubbles] = useState<VisibleBubble[]>([]);
  const prevCountRef = useRef(0);
  const prevLastContentRef = useRef<string>("");
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

  // Watch for new messages (length increase)
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const startIndex = prevCountRef.current;
      const count = messages.length - startIndex;
      const now = Date.now();

      // Generate IDs upfront so they match between state update and timer scheduling
      const newIds = Array.from({ length: count }, (_, i) => `${now}-${startIndex + i}`);

      setBubbles((prev) => {
        const newBubbles: VisibleBubble[] = newIds.map((id, i) => ({
          id,
          messageIndex: startIndex + i,
          state: "entering" as const,
        }));

        // Skip streaming messages — they'll be caught when complete
        const filtered = newBubbles.filter((b) => {
          const msg = messages[b.messageIndex];
          return msg && !msg.isStreaming;
        });

        if (filtered.length === 0) return prev;

        // Combine and keep only last MAX_VISIBLE
        const combined = [...prev, ...filtered];
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

      // Schedule dismiss for non-streaming messages
      newIds.forEach((id, i) => {
        const msg = messages[startIndex + i];
        if (msg && !msg.isStreaming) {
          scheduleDismiss(id);
        }
      });

      // Transition entering → visible after animation
      setTimeout(() => {
        setBubbles((prev) => prev.map((b) => (b.state === "entering" ? { ...b, state: "visible" } : b)));
      }, 350);
    }
    prevCountRef.current = messages.length;
  }, [messages, scheduleDismiss]);

  // Watch for streaming message becoming complete (content changes without length change).
  // When the streaming message is replaced by the final message (pop+push, same length),
  // we detect it here and create a bubble for the complete message.
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    const lastContent = lastMsg?.content || "";

    // Detect: same length as before, last message content changed, and message is NOT streaming
    if (
      messages.length === prevCountRef.current &&
      lastContent !== prevLastContentRef.current &&
      lastMsg &&
      !lastMsg.isStreaming
    ) {
      const messageIndex = messages.length - 1;
      const now = Date.now();
      const id = `${now}-complete-${messageIndex}`;

      // Check if we already have a bubble for this index
      setBubbles((prev) => {
        const existing = prev.find((b) => b.messageIndex === messageIndex && b.state !== "exiting");
        if (existing) return prev; // Already showing this message

        const newBubble: VisibleBubble = { id, messageIndex, state: "entering" };
        const combined = [...prev, newBubble];
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

      scheduleDismiss(id);

      setTimeout(() => {
        setBubbles((prev) => prev.map((b) => (b.state === "entering" ? { ...b, state: "visible" } : b)));
      }, 350);
    }

    prevLastContentRef.current = lastContent;
  }, [messages, scheduleDismiss]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-3 sm:px-8 pointer-events-none shrink-0">
      <div className="flex flex-col gap-2 pb-2 max-h-[40vh] overflow-y-auto scrollbar-hide">
        {bubbles.map((bubble) => {
          const message = messages[bubble.messageIndex];
          if (!message) return null;

          const isMona = message.sender === "mona";
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
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                  isMona
                    ? "glass-bubble-mona border border-pink-200/40 text-slate-800 dark:border-pink-500/30 dark:text-slate-100"
                    : "glass-bubble border border-purple-200/40 text-slate-800 dark:border-purple-500/30 dark:text-slate-100"
                }`}
              >
                {message.content}
                {isMona && message.emotion?.emotion && (
                  <span className="ml-2 inline-block rounded-full bg-purple-100/80 px-1.5 py-0.5 text-[10px] font-medium text-purple-600 align-middle dark:bg-purple-900/40 dark:text-purple-400">
                    {message.emotion.emotion.charAt(0).toUpperCase() + message.emotion.emotion.slice(1)}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="self-start max-w-[85%] animate-bubbleIn">
            <div className="glass-bubble-mona rounded-2xl border border-pink-200/40 px-4 py-3 dark:border-pink-500/30">
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
            <div className="glass-bubble-mona rounded-2xl border border-purple-200/40 px-4 py-3 dark:border-purple-500/30">
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
