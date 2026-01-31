export interface EmotionData {
  emotion: string;
  intensity: string;
  timestamp: string;
  gesture?: string;  // Optional gesture animation to play (e.g., "wave", "clapping", "thinking")
}

// Lip sync cue - timing data for mouth shapes
export interface LipSyncCue {
  start: number;  // Start time in seconds
  end: number;    // End time in seconds
  shape: string;  // Mouth shape (A-H, X)
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

// Audio segment for sentence-level TTS pipelining
export interface AudioSegment {
  audioUrl: string;
  lipSync?: LipSyncCue[];
  segmentIndex: number;
  isPlaying?: boolean;
  isPlayed?: boolean;
}

export interface WebSocketMessage {
  type: "message" | "message_chunk" | "typing" | "error" | "audio_ready" | "audio_chunk" | "audio_complete" | "audio_segment" | "auth_status" | "chat_history" | "guest_limit_reached";
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
  segmentIndex?: number;  // For sentence-level audio segments
  totalAudioSegments?: number;  // Total expected audio segments
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
