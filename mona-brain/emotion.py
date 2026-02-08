"""
Emotion Engine for Mona

Tracks and manages Mona's emotional state based on conversation context.
"""

import random
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

from openai import AsyncOpenAI


class EmotionType(str, Enum):
    """Primary emotion types"""
    # Positive emotions
    HAPPY = "happy"
    EXCITED = "excited"
    CONTENT = "content"
    CURIOUS = "curious"
    AFFECTIONATE = "affectionate"
    PLAYFUL = "playful"

    # Neutral/Mixed emotions
    SURPRISED = "surprised"
    EMBARRASSED = "embarrassed"
    CONFUSED = "confused"
    BORED = "bored"
    NEUTRAL = "neutral"

    # Negative emotions
    CONCERNED = "concerned"
    SAD = "sad"
    ANNOYED = "annoyed"
    ANGRY = "angry"
    FRUSTRATED = "frustrated"


class EmotionIntensity(str, Enum):
    """Intensity levels for emotions"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class GestureType(str, Enum):
    """Available gesture animations - synced with gestureManager.ts"""
    # Greetings
    WAVE = "wave"
    GOODBYE = "goodbye"

    # Happy/Excited
    CLAPPING = "clapping"
    EXCITED_JUMP = "excited_jump"

    # Thinking/Curious
    THINKING = "thinking"
    LOOKING_AROUND = "looking_around"

    # Emotional
    BLUSH = "blush"
    SAD = "sad"
    ANGRY = "angry"
    SURPRISED = "surprised"

    # Idle/Neutral
    RELAX = "relax"
    SLEEPY = "sleepy"

    # Poses (hold poses from Mixamo FBX)
    CROUCH = "crouch"
    LAY = "lay"
    STAND = "stand"
    STAND1 = "stand1"
    DEFAULT = "default"
    STANDING_IDLE = "standing_idle"

    # No gesture
    NONE = "none"


# Map emotions to appropriate gestures (for automatic selection)
# NONE means use standing_idle, the default looping animation
EMOTION_TO_GESTURE = {
    EmotionType.HAPPY: [GestureType.CLAPPING, GestureType.STANDING_IDLE],
    EmotionType.EXCITED: [GestureType.EXCITED_JUMP, GestureType.CLAPPING],
    EmotionType.CONTENT: [GestureType.RELAX, GestureType.STANDING_IDLE],
    EmotionType.CURIOUS: [GestureType.THINKING, GestureType.LOOKING_AROUND],
    EmotionType.AFFECTIONATE: [GestureType.BLUSH, GestureType.STANDING_IDLE],
    EmotionType.PLAYFUL: [GestureType.WAVE, GestureType.STANDING_IDLE],
    EmotionType.SURPRISED: [GestureType.SURPRISED],
    EmotionType.EMBARRASSED: [GestureType.BLUSH],
    EmotionType.CONFUSED: [GestureType.THINKING, GestureType.LOOKING_AROUND],
    EmotionType.BORED: [GestureType.SLEEPY, GestureType.STANDING_IDLE],
    EmotionType.NEUTRAL: [GestureType.STANDING_IDLE, GestureType.RELAX],
    EmotionType.CONCERNED: [GestureType.SAD, GestureType.STANDING_IDLE],
    EmotionType.SAD: [GestureType.SAD],
    EmotionType.ANNOYED: [GestureType.ANGRY, GestureType.STANDING_IDLE],
    EmotionType.ANGRY: [GestureType.ANGRY],
    EmotionType.FRUSTRATED: [GestureType.ANGRY, GestureType.SAD],
}


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

        # TEST COMMANDS - Check first for explicit emotion triggers
        if message_lower.startswith("test:"):
            emotion_name = message_lower.replace("test:", "").strip()
            emotion_map = {
                "happy": EmotionType.HAPPY,
                "excited": EmotionType.EXCITED,
                "content": EmotionType.CONTENT,
                "curious": EmotionType.CURIOUS,
                "affectionate": EmotionType.AFFECTIONATE,
                "playful": EmotionType.PLAYFUL,
                "surprised": EmotionType.SURPRISED,
                "embarrassed": EmotionType.EMBARRASSED,
                "confused": EmotionType.CONFUSED,
                "bored": EmotionType.BORED,
                "neutral": EmotionType.NEUTRAL,
                "concerned": EmotionType.CONCERNED,
                "sad": EmotionType.SAD,
                "annoyed": EmotionType.ANNOYED,
                "angry": EmotionType.ANGRY,
                "frustrated": EmotionType.FRUSTRATED,
            }
            if emotion_name in emotion_map:
                return emotion_map[emotion_name]

        # Negative emotions (check first - they're more specific)
        if any(word in message_lower for word in ["angry", "mad", "furious", "pissed", "rage"]):
            return EmotionType.ANGRY

        if any(word in message_lower for word in ["annoyed", "irritated", "bothered", "annoying", "irritating"]):
            return EmotionType.ANNOYED

        if any(word in message_lower for word in ["frustrated", "frustrating", "can't figure", "giving up"]):
            return EmotionType.FRUSTRATED

        if any(word in message_lower for word in ["boring", "bored", "meh", "whatever", "don't care"]):
            return EmotionType.BORED

        if any(word in message_lower for word in ["sad", "depressed", "unhappy", "down", "cry"]):
            return EmotionType.SAD

        if any(word in message_lower for word in ["worried", "concerned", "anxious", "nervous"]):
            return EmotionType.CONCERNED

        if any(word in message_lower for word in ["sorry", "apologize", "my bad", "my fault"]):
            return EmotionType.CONCERNED

        # Positive emotions
        if any(word in message_lower for word in ["love", "amazing", "awesome", "wonderful", "great", "fantastic"]):
            return EmotionType.HAPPY

        if any(word in message_lower for word in ["excited", "can't wait", "yay", "omg", "woohoo"]):
            return EmotionType.EXCITED

        if any(word in message_lower for word in ["thank", "thanks", "appreciate", "grateful"]):
            return EmotionType.AFFECTIONATE

        if any(word in message_lower for word in ["haha", "lol", "hehe", "funny", "joke", "tease"]):
            return EmotionType.PLAYFUL

        # Confused state
        if any(word in message_lower for word in ["confused", "don't understand", "what do you mean", "huh", "???"]):
            return EmotionType.CONFUSED

        # Questions and curiosity
        if "?" in user_message or any(word in message_lower for word in ["what", "why", "how", "when", "where", "tell me"]):
            return EmotionType.CURIOUS

        # Greetings
        if any(word in message_lower for word in ["hello", "hi", "hey", "good morning", "good evening", "sup"]):
            return EmotionType.HAPPY

        # Compliments (makes Mona embarrassed)
        if any(word in message_lower for word in ["cute", "beautiful", "pretty", "attractive", "lovely", "gorgeous"]):
            return EmotionType.EMBARRASSED

        # Default
        return EmotionType.CONTENT

    async def analyze_message_llm(
        self, client: AsyncOpenAI, user_message: str, mona_response: str
    ) -> EmotionType:
        """Use GPT-4o-mini to detect the most appropriate emotion for Mona.

        Runs as a background task after the response is streamed so it has
        zero latency impact.  Falls back to the keyword-based
        ``analyze_message()`` on any error.
        """
        # Honour the test: command shortcut — check before hitting the LLM
        message_lower = user_message.lower()
        if message_lower.startswith("test:"):
            return self.analyze_message(user_message)

        valid_emotions = ", ".join(e.value for e in EmotionType)

        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You decide what emotion a virtual companion should express. "
                            f"Valid emotions: {valid_emotions}. "
                            "Reply with ONLY the emotion name, nothing else."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f'User said: "{user_message}"\n'
                            f'Companion replied: "{mona_response}"'
                        ),
                    },
                ],
                temperature=0.1,
                max_tokens=10,
            )

            emotion_str = response.choices[0].message.content.strip().lower()

            # Validate against enum
            try:
                emotion = EmotionType(emotion_str)
            except ValueError:
                emotion = self.analyze_message(user_message)

            # Apply the refined emotion to current state
            self.emotion_history.append(self.current_state)
            self.current_state = EmotionState(
                primary_emotion=emotion,
                intensity=EmotionIntensity.MEDIUM,
                timestamp=datetime.now(),
            )
            if len(self.emotion_history) > 10:
                self.emotion_history.pop(0)

            return emotion

        except Exception as e:
            print(f"⚠ LLM emotion detection failed, using keyword fallback: {e}")
            return self.analyze_message(user_message)

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
        Get emotion data formatted for 3D avatar facial expressions and gestures.
        Includes a gesture recommendation based on current emotion.
        """
        # Select an appropriate gesture based on emotion
        emotion = self.current_state.primary_emotion
        possible_gestures = EMOTION_TO_GESTURE.get(emotion, [GestureType.NONE])

        # For high intensity emotions, always use a gesture (skip NONE)
        if self.current_state.intensity == EmotionIntensity.HIGH:
            non_none_gestures = [g for g in possible_gestures if g != GestureType.NONE]
            if non_none_gestures:
                possible_gestures = non_none_gestures

        # Randomly select from possible gestures
        selected_gesture = random.choice(possible_gestures)

        return {
            "emotion": emotion.value,
            "intensity": self.current_state.intensity.value,
            "timestamp": self.current_state.timestamp.isoformat(),
            "gesture": selected_gesture.value,
        }

    def reset(self):
        """Reset emotion state to neutral"""
        self.current_state = EmotionState()
        self.emotion_history = []


# Emotion-to-expression mapping for Moe.vrm avatar
# Available Moe.vrm expressions: neutral, happy, angry, sad, relaxed,
#   blink, blinkLeft, blinkRight, lookUp, lookDown, lookLeft, lookRight,
#   aa, ih, ou, ee, oh (visemes), Special, CheekPuff
EMOTION_TO_BLENDSHAPES = {
    # Positive emotions
    EmotionType.HAPPY: {"happy": 0.9},
    EmotionType.EXCITED: {"happy": 1.0},
    EmotionType.CONTENT: {"relaxed": 0.7},
    EmotionType.AFFECTIONATE: {"happy": 0.8},
    EmotionType.PLAYFUL: {"happy": 0.7},

    # Neutral/Mixed emotions
    EmotionType.CURIOUS: {"neutral": 1.0},
    EmotionType.SURPRISED: {"happy": 0.6},  # No surprise expression, use happy
    EmotionType.EMBARRASSED: {"Special": 1.0},  # Special blush expression
    EmotionType.CONFUSED: {"neutral": 1.0},
    EmotionType.BORED: {"relaxed": 0.8},
    EmotionType.NEUTRAL: {"neutral": 1.0},

    # Negative emotions
    EmotionType.CONCERNED: {"sad": 0.5},
    EmotionType.SAD: {"sad": 0.9},
    EmotionType.ANNOYED: {"angry": 0.6},
    EmotionType.ANGRY: {"angry": 1.0},
    EmotionType.FRUSTRATED: {"angry": 0.7, "sad": 0.3},
}
