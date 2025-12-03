"""
Emotion Engine for Mona

Tracks and manages Mona's emotional state based on conversation context.
"""

from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class EmotionType(str, Enum):
    """Primary emotion types"""
    HAPPY = "happy"
    EXCITED = "excited"
    CONTENT = "content"
    CURIOUS = "curious"
    SURPRISED = "surprised"
    CONCERNED = "concerned"
    SAD = "sad"
    EMBARRASSED = "embarrassed"
    AFFECTIONATE = "affectionate"
    NEUTRAL = "neutral"


class EmotionIntensity(str, Enum):
    """Intensity levels for emotions"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class EmotionState(BaseModel):
    """Current emotional state"""
    primary_emotion: EmotionType = EmotionType.NEUTRAL
    intensity: EmotionIntensity = EmotionIntensity.MEDIUM
    secondary_emotion: Optional[EmotionType] = None
    timestamp: datetime = Field(default_factory=datetime.now)

    def to_string(self) -> str:
        """Convert emotion state to readable string"""
        base = f"{self.intensity.value} {self.primary_emotion.value}"
        if self.secondary_emotion:
            base += f" with {self.secondary_emotion.value}"
        return base


class EmotionEngine:
    """Manages Mona's emotional state throughout conversation"""

    def __init__(self):
        self.current_state = EmotionState()
        self.emotion_history: List[EmotionState] = []

    def analyze_message(self, user_message: str) -> EmotionType:
        """
        Analyze user message and determine appropriate emotional response.
        This is a simple keyword-based approach for Week 2.
        Week 3+ will use LLM-based emotion detection.
        """
        message_lower = user_message.lower()

        # Positive emotions
        if any(word in message_lower for word in ["love", "amazing", "awesome", "wonderful", "great"]):
            return EmotionType.HAPPY

        if any(word in message_lower for word in ["excited", "can't wait", "yay", "omg"]):
            return EmotionType.EXCITED

        if any(word in message_lower for word in ["thank", "thanks", "appreciate"]):
            return EmotionType.AFFECTIONATE

        # Questions and curiosity
        if "?" in user_message or any(word in message_lower for word in ["what", "why", "how", "when", "where"]):
            return EmotionType.CURIOUS

        # Negative emotions
        if any(word in message_lower for word in ["sad", "depressed", "unhappy", "down"]):
            return EmotionType.CONCERNED

        if any(word in message_lower for word in ["sorry", "apologize", "my bad"]):
            return EmotionType.CONCERNED

        # Greetings
        if any(word in message_lower for word in ["hello", "hi", "hey", "good morning", "good evening"]):
            return EmotionType.HAPPY

        # Compliments (makes Mona embarrassed)
        if any(word in message_lower for word in ["cute", "beautiful", "pretty", "attractive", "lovely"]):
            return EmotionType.EMBARRASSED

        # Default
        return EmotionType.CONTENT

    def update_emotion(self, user_message: str, intensity: EmotionIntensity = EmotionIntensity.MEDIUM):
        """Update Mona's emotion based on user message"""
        new_emotion = self.analyze_message(user_message)

        # Save current state to history
        self.emotion_history.append(self.current_state)

        # Update to new state
        self.current_state = EmotionState(
            primary_emotion=new_emotion,
            intensity=intensity,
            timestamp=datetime.now()
        )

        # Keep history manageable (last 10 emotions)
        if len(self.emotion_history) > 10:
            self.emotion_history.pop(0)

    def get_current_emotion(self) -> str:
        """Get current emotion as a string for system prompt"""
        return self.current_state.to_string()

    def get_emotion_for_expression(self) -> dict:
        """
        Get emotion data formatted for 3D avatar facial expressions.
        This will be used in Week 4 when we add the 3D avatar.
        """
        return {
            "emotion": self.current_state.primary_emotion.value,
            "intensity": self.current_state.intensity.value,
            "timestamp": self.current_state.timestamp.isoformat(),
        }

    def reset(self):
        """Reset emotion state to neutral"""
        self.current_state = EmotionState()
        self.emotion_history = []


# Emotion-to-expression mapping for future 3D avatar (Week 4)
EMOTION_TO_BLENDSHAPES = {
    EmotionType.HAPPY: {"Joy": 0.8, "Smile": 0.9},
    EmotionType.EXCITED: {"Joy": 1.0, "Surprise": 0.6},
    EmotionType.CONTENT: {"Smile": 0.5, "Relaxed": 0.7},
    EmotionType.CURIOUS: {"Surprise": 0.4, "Focus": 0.8},
    EmotionType.SURPRISED: {"Surprise": 1.0, "EyesWide": 0.9},
    EmotionType.CONCERNED: {"Sad": 0.5, "Worry": 0.7},
    EmotionType.SAD: {"Sad": 0.8, "MouthFrown": 0.6},
    EmotionType.EMBARRASSED: {"Blush": 0.9, "LookAway": 0.6, "Smile": 0.4},
    EmotionType.AFFECTIONATE: {"Joy": 0.7, "Smile": 0.8, "Blush": 0.3},
    EmotionType.NEUTRAL: {"Neutral": 1.0},
}
