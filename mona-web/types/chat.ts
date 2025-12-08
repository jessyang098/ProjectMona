export interface EmotionData {
  emotion: string;
  intensity: string;
  timestamp: string;
}

export interface Message {
  content: string;
  sender: "user" | "mona";
  timestamp: string;
  emotion?: EmotionData;
  isStreaming?: boolean;
  audioUrl?: string;
  imageUrl?: string;  // For displaying uploaded images in chat
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
}
