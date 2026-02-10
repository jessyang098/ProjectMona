"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AudioSegment, EmotionData, LipSyncCue, Message, WebSocketMessage } from "@/types/chat";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const MAX_RECONNECT_ATTEMPTS = 7;

interface AuthStatus {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  } | null;
  guestMessagesRemaining: number | null;
  guestMessageLimit: number | null;
}

interface UseWebSocketOptions {
  onAuthStatus?: (status: AuthStatus) => void;
  onGuestLimitReached?: (messagesUsed: number, messageLimit: number) => void;
  onChatHistory?: (messages: Message[]) => void;
}

export function useWebSocket(url: string, options?: UseWebSocketOptions, clientId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [latestEmotion, setLatestEmotion] = useState<EmotionData | null>(null);
  const [guestMessagesRemaining, setGuestMessagesRemaining] = useState<number | null>(null);
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  const [totalAudioSegments, setTotalAudioSegments] = useState<number | null>(null);
  const [nextExpectedIndex, setNextExpectedIndex] = useState<number>(0);  // Track which segment to play next
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [affectionLevel, setAffectionLevel] = useState<string>("distant");
  const [affectionScore, setAffectionScore] = useState<number>(35);
  const websocketRef = useRef<WebSocket | null>(null);
  const pendingImageRef = useRef<string | null>(null);  // Store pending image for echo
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageQueueRef = useRef<string[]>([]);
  const intentionalCloseRef = useRef<boolean>(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    // Use provided clientId (from AuthContext), fall back to localStorage
    const resolvedClientId = clientId || localStorage.getItem("mona_guest_session_id") || "client-fallback";
    const wsUrl = `${url}/${resolvedClientId}`;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      websocketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptRef.current = 0;

        // Flush queued messages
        const queue = messageQueueRef.current;
        messageQueueRef.current = [];
        for (const msg of queue) {
          ws.send(msg);
        }

        // Start heartbeat ping every 25 seconds
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          // Ignore pong responses from heartbeat
          if (data.type === "pong") return;

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

            // If this is Mona's message without audio, start generating audio
            if (data.sender === "mona" && !audioUrl) {
              setIsGeneratingAudio(true);
            }

            setMessages((prev) => {
              const next = [...prev];
              if (next.length && next[next.length - 1].isStreaming) {
                next.pop();
              }
              // Deduplicate: skip if last message has same content, sender, and similar timestamp
              const last = next[next.length - 1];
              if (last && last.sender === newMessage.sender && last.content === newMessage.content) {
                return next;
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
                // New response starting - clear audio segments queue
                setAudioSegments([]);
                setTotalAudioSegments(null);
                setNextExpectedIndex(0);  // Reset expected index for new response

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
            // Update the most recent Mona message with the audio URL and lip sync data
            const fullAudioUrl = `${BACKEND_URL}${data.audioUrl}`;

            // Stop audio generation indicator
            setIsGeneratingAudio(false);

            // Store total segments count if provided (for legacy/fallback)
            if (data.totalAudioSegments !== undefined) {
              setTotalAudioSegments(data.totalAudioSegments);
            }

            setMessages((prev) => {
              // Find the last message from Mona
              const lastMonaIndex = prev.length - 1 - [...prev].reverse().findIndex(m => m.sender === "mona");

              if (lastMonaIndex >= 0 && lastMonaIndex < prev.length) {
                const next = [...prev];
                next[lastMonaIndex] = {
                  ...next[lastMonaIndex],
                  audioUrl: fullAudioUrl,
                  lipSync: data.lipSync,  // Include lip sync timing data
                };

                return next;
              }

              return prev;
            });
          } else if (data.type === "audio_segment" && data.audioUrl !== undefined) {
            // Handle sentence-level audio segments (pipelined TTS)
            const fullAudioUrl = `${BACKEND_URL}${data.audioUrl}`;
            const segmentIndex = data.segmentIndex ?? 0;

            // Add segment to queue (sorted by index)
            setAudioSegments((prev) => {
              const newSegment: AudioSegment = {
                audioUrl: fullAudioUrl,
                lipSync: data.lipSync,
                segmentIndex: segmentIndex,
                isPlaying: false,
                isPlayed: false,
              };

              // Insert in correct position based on segmentIndex
              const updated = [...prev, newSegment].sort((a, b) => a.segmentIndex - b.segmentIndex);
              return updated;
            });

            // First segment received - stop showing "generating audio" indicator
            if (segmentIndex === 0) {
              setIsGeneratingAudio(false);
            }
          } else if (data.type === "auth_status") {
            // Handle auth status from server
            setGuestMessagesRemaining(data.guestMessagesRemaining ?? null);
            if (data.affection) {
              setAffectionLevel(data.affection.level || "distant");
              setAffectionScore(data.affection.score || 35);
            }
            if (optionsRef.current?.onAuthStatus) {
              optionsRef.current.onAuthStatus({
                isAuthenticated: data.isAuthenticated ?? false,
                user: data.user ?? null,
                guestMessagesRemaining: data.guestMessagesRemaining ?? null,
                guestMessageLimit: data.guestMessageLimit ?? null,
              });
            }
          } else if (data.type === "affection_update") {
            setAffectionLevel(data.level || "distant");
            setAffectionScore(data.score || 35);
          } else if (data.type === "chat_history") {
            // Handle chat history from server (for authenticated users)
            if (data.messages && optionsRef.current?.onChatHistory) {
              const historyMessages: Message[] = data.messages.map((msg: { content: string; sender: string; timestamp: string; emotion?: EmotionData }) => ({
                content: msg.content,
                sender: msg.sender as "user" | "mona",
                timestamp: msg.timestamp,
                emotion: msg.emotion,
              }));
              optionsRef.current.onChatHistory(historyMessages);
              setMessages(historyMessages);
            }
          } else if (data.type === "guest_limit_reached") {
            // Handle guest limit reached
            setGuestMessagesRemaining(0);
            if (optionsRef.current?.onGuestLimitReached) {
              optionsRef.current.onGuestLimitReached(data.messagesUsed ?? 0, data.messageLimit ?? 25);
            }
          }
        } catch (error) {
          // Silently handle parse errors
        }
      };

      ws.onerror = () => {
        setConnectionError("Connection error");
      };

      ws.onclose = (event) => {
        setIsConnected(false);

        // Clear heartbeat interval
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Reconnect if not intentional close (code 1000)
        if (!intentionalCloseRef.current && event.code !== 1000) {
          const attempt = reconnectAttemptRef.current;
          reconnectAttemptRef.current = attempt + 1;

          if (attempt + 1 >= MAX_RECONNECT_ATTEMPTS) {
            setConnectionError("Unable to connect to Mona. Please refresh the page.");
            return;
          }

          const baseDelay = Math.min(1000 * Math.pow(2, attempt), 30000);
          const jitter = baseDelay * (0.8 + Math.random() * 0.4); // +/- 20%
          setConnectionError(`Disconnected. Reconnecting in ${Math.round(jitter / 1000)}s...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, jitter);
        }
      };
    };

    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.close(1000);
      }
    };
  }, [url, clientId]);

  const sendMessage = useCallback((content: string, imageBase64?: string, ttsEngine?: string, lipSyncMode?: string) => {
    // Store image for when we receive the echoed message back
    if (imageBase64) {
      pendingImageRef.current = imageBase64;
    }

    const message: { content: string; timestamp: string; image?: string; tts_engine?: string; lip_sync_mode?: string } = {
      content: content || (imageBase64 ? "What do you think of this?" : ""),
      timestamp: new Date().toISOString(),
    };
    if (imageBase64) {
      message.image = imageBase64;
    }
    if (ttsEngine) {
      message.tts_engine = ttsEngine;
    }
    if (lipSyncMode) {
      message.lip_sync_mode = lipSyncMode;
    }

    const serialized = JSON.stringify(message);
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(serialized);
    } else {
      // Queue message for when connection is restored
      messageQueueRef.current.push(serialized);
    }
  }, []);

  // Mark a segment as currently playing
  const markSegmentPlaying = useCallback((segmentIndex: number) => {
    setAudioSegments((prev) =>
      prev.map((seg) => ({
        ...seg,
        isPlaying: seg.segmentIndex === segmentIndex,
      }))
    );
  }, []);

  // Mark a segment as played (completed) and advance to next expected
  const markSegmentPlayed = useCallback((segmentIndex: number) => {
    setAudioSegments((prev) =>
      prev.map((seg) =>
        seg.segmentIndex === segmentIndex
          ? { ...seg, isPlaying: false, isPlayed: true }
          : seg
      )
    );
    // Advance to next expected segment
    setNextExpectedIndex((prev) => prev + 1);
  }, []);

  // Get the next segment to play (only if it matches expected index - enforces strict ordering)
  const getNextSegment = useCallback((): AudioSegment | null => {
    const expectedSegment = audioSegments.find(
      (seg) => seg.segmentIndex === nextExpectedIndex && !seg.isPlayed && !seg.isPlaying
    );
    return expectedSegment ?? null;
  }, [audioSegments, nextExpectedIndex]);

  // Clear all audio segments (for stopping playback)
  const clearAudioSegments = useCallback(() => {
    setAudioSegments([]);
    setTotalAudioSegments(null);
    setNextExpectedIndex(0);
  }, []);

  return {
    messages,
    isConnected,
    isTyping,
    isGeneratingAudio,
    latestEmotion,
    guestMessagesRemaining,
    connectionError,
    affectionLevel,
    affectionScore,
    sendMessage,
    // Audio segment queue for sentence-level TTS
    audioSegments,
    totalAudioSegments,
    markSegmentPlaying,
    markSegmentPlayed,
    getNextSegment,
    clearAudioSegments,
  };
}
