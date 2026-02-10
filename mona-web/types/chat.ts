export interface EmotionData {
  emotion: string;
  intensity: string;
  timestamp: string;
  gesture?: string;  // Optional gesture animation to play (e.g., "wave", "sad", "sleepy")
}

// Lip sync modes
export type LipSyncMode = 'timed' | 'realtime' | 'formant' | 'mobile';

// Formant-based lip sync configuration
export interface FormantConfig {
  f1Weight: number;           // Weight of F1 in jaw calculation (0-1)
  f2Weight: number;           // Weight of F2 in lip shape (0-1)
  consonantSensitivity: number; // Sibilant detection threshold (0-1)
  useAsymmetricEasing: boolean; // Enable fast attack/slow release
  attackMultiplier: number;   // Multiply attack speed (1.0 = default)
  releaseMultiplier: number;  // Multiply release speed (1.0 = default)
  amplitudeModulation: boolean; // Modulate with real-time amplitude
  microMovementEnabled: boolean; // Add subtle variation
  microMovementAmplitude: number; // Micro-movement intensity (0.01-0.05)
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
  type: "message" | "message_chunk" | "typing" | "error" | "audio_ready" | "audio_chunk" | "audio_complete" | "audio_segment" | "auth_status" | "chat_history" | "guest_limit_reached" | "affection_update" | "pong";
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
  // Affection fields
  affection?: { score: number; level: string };
  level?: string;   // For affection_update messages
  score?: number;   // For affection_update messages
}
