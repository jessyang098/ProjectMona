"use client";

import { Message } from "@/types/chat";
import Image from "next/image";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === "user";
  const timestamp = message.isStreaming
    ? "Thinking..."
    : new Date(message.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

  const hasImage = !!message.imageUrl;
  const hasContent = !!message.content?.trim();

  return (
    <div
      className={`flex mb-3 ${isUser ? "justify-end" : "justify-start"} animate-fadeIn`}
    >
      <div className={`flex max-w-[85%] ${isUser ? "flex-row-reverse" : "flex-row"} gap-2.5`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-semibold ${
            isUser
              ? "bg-slate-700 text-white dark:bg-slate-600"
              : "bg-gradient-to-br from-pink-500 to-purple-600 text-white"
          }`}
        >
          {isUser ? "Y" : "M"}
        </div>

        {/* Message bubble */}
        <div className="flex flex-col">
          <div
            className={`px-3.5 py-2.5 transition-colors ${
              isUser
                ? "bg-slate-700 text-white rounded-2xl rounded-tr-md hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500"
                : "bg-white text-slate-800 rounded-2xl rounded-tl-md border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-750"
            } ${message.isStreaming ? "animate-pulseGlow" : ""}`}
          >
            {/* Display image if present */}
            {hasImage && (
              <div className="mb-2">
                <Image
                  src={message.imageUrl!}
                  alt="Uploaded image"
                  width={180}
                  height={180}
                  className="rounded-xl object-cover max-w-full"
                  unoptimized // Required for base64 images
                />
              </div>
            )}
            {/* Display text content */}
            {hasContent && (
              <p className="text-[13px] leading-relaxed">{message.content}</p>
            )}
            {/* If no content and no image, show placeholder */}
            {!hasContent && !hasImage && (
              <p className="text-[13px] leading-relaxed italic opacity-60">...</p>
            )}
          </div>
          <div className={`mt-1.5 flex flex-wrap items-center gap-2 text-[10px] ${isUser ? "justify-end pr-1" : "justify-start pl-1"}`}>
            <span className="text-slate-400 dark:text-slate-500">{timestamp}</span>
            {!isUser && message.emotion && message.emotion.emotion && message.emotion.intensity && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-600 font-medium animate-fadeIn dark:bg-purple-900/30 dark:text-purple-400">
                {`${capitalize(message.emotion.emotion)}`}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function capitalize(value: string | undefined) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
