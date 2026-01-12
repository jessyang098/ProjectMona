export interface EmotionData {
  emotion: string;
  intensity: string;
  timestamp: string;
  gesture?: string;  // Optional gesture animation to play (e.g., "wave", "clapping", "thinking")
}

// Lip sync cue from Rhubarb - timing data for mouth shapes
export interface LipSyncCue {
  start: number;  // Start time in seconds
  end: number;    // End time in seconds
  shape: string;  // Rhubarb mouth shape (A-H, X)
  phonemes: {     // VRM blend shape values
    aa: number;
    ee: number;
    ih: number;
    oh: number;
    ou: number;
  };
}

export interface Message {
  content: string;
  sender: "user" | "mona";
  timestamp: string;
  emotion?: EmotionData;
  isStreaming?: boolean;
  audioUrl?: string;
  imageUrl?: string;  // For displaying uploaded images in chat
  lipSync?: LipSyncCue[];  // Lip sync timing data
}

// Audio chunk for pipelined TTS
export interface AudioChunk {
  audioUrl: string;
  lipSync?: LipSyncCue[];
  chunkIndex: number;
}

export interface WebSocketMessage {
  type: "message" | "message_chunk" | "typing" | "error" | "audio_ready" | "audio_chunk" | "audio_complete" | "auth_status" | "chat_history" | "guest_limit_reached";
  content?: string;
  sender?: "user" | "mona";
  timestamp?: string;
  isTyping?: boolean;
  emotion?: EmotionData;
  error?: string;
  audioUrl?: string;
  imageUrl?: string;  // For displaying uploaded images
  lipSync?: LipSyncCue[];  // Lip sync timing data
  chunkIndex?: number;  // For audio chunks
  totalChunks?: number;  // Total expected audio chunks
  totalAudioChunks?: number;  // Total audio chunks in message
  // Auth-related fields
  isAuthenticated?: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  } | null;
  guestMessagesRemaining?: number | null;
  guestMessageLimit?: number | null;
  messages?: Array<{ content: string; sender: string; timestamp: string; emotion?: EmotionData }>;
  messagesUsed?: number;
  messageLimit?: number;
}
