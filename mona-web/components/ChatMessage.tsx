"use client";

import { Message } from "@/types/chat";
import Image from "next/image";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === "user";
  const timestamp = message.isStreaming
    ? "Streaming..."
    : new Date(message.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

  const hasImage = !!message.imageUrl;
  const hasContent = !!message.content?.trim();

  return (
    <div
      className={`flex mb-4 ${isUser ? "justify-end" : "justify-start"} animate-fadeIn`}
    >
      <div className={`flex max-w-[80%] ${isUser ? "flex-row-reverse" : "flex-row"} gap-3`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
            isUser
              ? "bg-blue-600 text-white"
              : "bg-gradient-to-br from-pink-400 to-purple-500 text-white"
          }`}
        >
          {isUser ? "You" : "M"}
        </div>

        {/* Message bubble */}
        <div className="flex flex-col">
          <div
            className={`px-4 py-2 rounded-2xl ${
              isUser
                ? "bg-blue-600 text-white rounded-tr-none"
                : "bg-gray-800 text-gray-100 rounded-tl-none"
            } ${message.isStreaming ? "animate-pulseGlow" : ""}`}
          >
            {/* Display image if present */}
            {hasImage && (
              <div className="mb-2">
                <Image
                  src={message.imageUrl!}
                  alt="Uploaded image"
                  width={200}
                  height={200}
                  className="rounded-lg object-cover max-w-full"
                  unoptimized // Required for base64 images
                />
              </div>
            )}
            {/* Display text content */}
            {hasContent && (
              <p className="text-sm leading-relaxed">{message.content}</p>
            )}
            {/* If no content and no image, show placeholder */}
            {!hasContent && !hasImage && (
              <p className="text-sm leading-relaxed italic opacity-70">...</p>
            )}
          </div>
          <div className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${isUser ? "justify-end" : "justify-start"}`}>
            <span className="text-gray-500">{timestamp}</span>
            {!isUser && message.emotion && message.emotion.emotion && message.emotion.intensity && (
              <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-purple-200">
                {`${capitalize(message.emotion.emotion)} · ${capitalize(message.emotion.intensity)}`}
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
