"use client";

import { useRef, useEffect } from "react";
import type { Message } from "@/types/chat";
import ChatMessage from "./ChatMessage";

interface ChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
}

export default function ChatHistoryModal({ isOpen, onClose, messages }: ChatHistoryModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when opened
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-auto mt-16 flex w-full max-w-lg flex-1 flex-col overflow-hidden rounded-t-3xl bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Chat History</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/50 dark:to-purple-900/50">
                <svg className="h-6 w-6 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No messages yet</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Say hi to Mona to start</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <ChatMessage key={`${message.timestamp}-${index}`} message={message} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
