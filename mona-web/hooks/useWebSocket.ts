"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { EmotionData, Message, WebSocketMessage } from "@/types/chat";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export function useWebSocket(url: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [latestEmotion, setLatestEmotion] = useState<EmotionData | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const pendingImageRef = useRef<string | null>(null);  // Store pending image for echo

  useEffect(() => {
    // Generate a unique client ID
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const wsUrl = `${url}/${clientId}`;

    console.log("Connecting to WebSocket:", wsUrl);

    const ws = new WebSocket(wsUrl);
    websocketRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        console.log("Received message:", data);

        if (data.type === "message" && data.sender) {
          // Construct full audio URL if provided
          const audioUrl = data.audioUrl ? `${BACKEND_URL}${data.audioUrl}` : undefined;

          // For user messages, attach any pending image
          let imageUrl: string | undefined;
          if (data.sender === "user" && pendingImageRef.current) {
            imageUrl = pendingImageRef.current;
            pendingImageRef.current = null;  // Clear after using
          }

          const newMessage: Message = {
            content: data.content || "",
            sender: data.sender,
            timestamp: data.timestamp || new Date().toISOString(),
            emotion: data.emotion,
            audioUrl: audioUrl,
            imageUrl: imageUrl,
          };

          console.log("📨 Message received:", {
            sender: newMessage.sender,
            hasEmotion: !!newMessage.emotion,
            hasImage: !!newMessage.imageUrl,
            audioUrl: newMessage.audioUrl,
          });

          // If this is Mona's message without audio, start generating audio
          if (data.sender === "mona" && !audioUrl) {
            setIsGeneratingAudio(true);
          }

          setMessages((prev) => {
            const next = [...prev];
            if (next.length && next[next.length - 1].isStreaming) {
              next.pop();
            }
            return [...next, newMessage];
          });

          if (data.emotion) {
            setLatestEmotion(data.emotion);
          }
        } else if (data.type === "message_chunk" && data.content) {
          const chunkContent = data.content || "";
          setMessages((prev) => {
            if (prev.length === 0 || !prev[prev.length - 1].isStreaming) {
              return [
                ...prev,
                {
                  content: chunkContent,
                  sender: "mona",
                  timestamp: data.timestamp || new Date().toISOString(),
                  isStreaming: true,
                },
              ];
            }

            const next = [...prev];
            next[next.length - 1] = {
              ...next[next.length - 1],
              content: `${next[next.length - 1].content}${chunkContent}`,
            };
            return next;
          });
        } else if (data.type === "typing") {
          setIsTyping(data.isTyping || false);
        } else if (data.type === "audio_ready" && data.audioUrl) {
          // Update the most recent Mona message with the audio URL
          const fullAudioUrl = `${BACKEND_URL}${data.audioUrl}`;

          console.log("🎵 Audio ready:", fullAudioUrl);

          // Stop audio generation indicator
          setIsGeneratingAudio(false);

          setMessages((prev) => {
            // Find the last message from Mona
            const lastMonaIndex = prev.length - 1 - [...prev].reverse().findIndex(m => m.sender === "mona");

            if (lastMonaIndex >= 0 && lastMonaIndex < prev.length) {
              const next = [...prev];
              next[lastMonaIndex] = {
                ...next[lastMonaIndex],
                audioUrl: fullAudioUrl,
              };

              console.log("✓ Updated message with audio URL");
              return next;
            }

            return prev;
          });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [url]);

  const sendMessage = useCallback((content: string, imageBase64?: string) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      // Store image for when we receive the echoed message back
      if (imageBase64) {
        pendingImageRef.current = imageBase64;
      }

      const message: { content: string; timestamp: string; image?: string } = {
        content: content || (imageBase64 ? "What do you think of this?" : ""),
        timestamp: new Date().toISOString(),
      };
      if (imageBase64) {
        message.image = imageBase64;
      }
      websocketRef.current.send(JSON.stringify(message));
      console.log("Sent message:", { ...message, image: imageBase64 ? "[base64 image]" : undefined });
    } else {
      console.error("WebSocket is not connected");
    }
  }, []);

  return {
    messages,
    isConnected,
    isTyping,
    isGeneratingAudio,
    latestEmotion,
    sendMessage,
  };
}
