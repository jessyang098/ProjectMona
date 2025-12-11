export interface EmotionData {
  emotion: string;
  intensity: string;
  timestamp: string;
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

export interface WebSocketMessage {
  type: "message" | "message_chunk" | "typing" | "error" | "audio_ready";
  content?: string;
  sender?: "user" | "mona";
  timestamp?: string;
  isTyping?: boolean;
  emotion?: EmotionData;
  error?: string;
  audioUrl?: string;
  imageUrl?: string;  // For displaying uploaded images
  lipSync?: LipSyncCue[];  // Lip sync timing data
}
