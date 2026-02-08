"""Affection tracking for Mona.

Keeps a lightweight relationship score per user so responses can feel
consistent over time.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict

from openai import AsyncOpenAI
from pydantic import BaseModel, Field


class AffectionLevel(str, Enum):
    """Buckets describing Mona's attachment to the user."""

    DISTANT = "distant"
    WARMING_UP = "warming_up"
    CLOSE = "close"
    DEVOTED = "devoted"


class AffectionState(BaseModel):
    """Score + metadata about the relationship."""

    score: int = Field(default=35, ge=0, le=100)
    level: AffectionLevel = AffectionLevel.DISTANT
    trend: str = "steady"
    last_interaction: datetime = Field(default_factory=datetime.utcnow)


class AffectionEngine:
    """Simple heuristic tracker for affection."""

    def __init__(self):
        self._states: Dict[str, AffectionState] = {}

    def _get_state(self, user_id: str) -> AffectionState:
        state = self._states.get(user_id)
        if state is None:
            state = AffectionState()
            self._states[user_id] = state
        return state

    def _score_to_level(self, score: int) -> AffectionLevel:
        if score >= 80:
            return AffectionLevel.DEVOTED
        if score >= 60:
            return AffectionLevel.CLOSE
        if score >= 40:
            return AffectionLevel.WARMING_UP
        return AffectionLevel.DISTANT

    def _delta_from_message(self, message: str) -> int:
        message_lower = message.lower()

        positive_keywords = ["love", "care", "thank", "appreciate", "miss you", "hug"]
        negative_keywords = ["hate", "annoy", "mad", "angry", "leave me", "shut up"]

        if any(keyword in message_lower for keyword in positive_keywords):
            return 5
        if any(keyword in message_lower for keyword in negative_keywords):
            return -6
        if "sorry" in message_lower or "apolog" in message_lower:
            return 2
        if any(word in message_lower for word in ["lol", "haha", "you're fun", "cute"]):
            return 3
        return 1  # default gentle drift upward when the user engages

    def update_affection(self, user_id: str, message: str) -> AffectionState:
        """Update and return the affection state after a user message."""

        state = self._get_state(user_id)
        delta = self._delta_from_message(message)
        new_score = max(0, min(100, state.score + delta))
        level = self._score_to_level(new_score)
        trend = "up" if delta > 0 else "down" if delta < 0 else "steady"

        new_state = AffectionState(
            score=new_score,
            level=level,
            trend=trend,
            last_interaction=datetime.utcnow(),
        )
        self._states[user_id] = new_state
        return new_state

    async def analyze_sentiment_llm(
        self, client: AsyncOpenAI, user_message: str, mona_response: str
    ) -> int:
        """Use GPT-4o-mini to score the sentiment delta of a user message.

        Returns a value between -10 and +10.
        Falls back to ``_delta_from_message()`` on error.
        """
        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are scoring how a message affects a virtual companion's affection "
                            "toward the user. Return a single integer from -10 to +10.\n"
                            "Examples:\n"
                            '  "I love pizza" → 2 (positive but not directed at companion)\n'
                            '  "I love you" → 8 (strong affection toward companion)\n'
                            '  "You\'re annoying" → -6 (negative toward companion)\n'
                            '  "Tell me about cats" → 1 (neutral engagement)\n'
                            "Reply with ONLY the integer, nothing else."
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
                temperature=0.2,
                max_tokens=5,
            )

            raw = response.choices[0].message.content.strip()
            delta = int(raw)
            return max(-10, min(10, delta))

        except Exception as e:
            print(f"⚠ LLM sentiment scoring failed, using keyword fallback: {e}")
            return self._delta_from_message(user_message)

    async def update_affection_llm(
        self,
        client: AsyncOpenAI,
        user_id: str,
        user_message: str,
        mona_response: str,
    ) -> AffectionState:
        """LLM-powered affection update.  Runs as a background task."""
        delta = await self.analyze_sentiment_llm(client, user_message, mona_response)
        state = self._get_state(user_id)
        new_score = max(0, min(100, state.score + delta))
        level = self._score_to_level(new_score)
        trend = "up" if delta > 0 else "down" if delta < 0 else "steady"

        new_state = AffectionState(
            score=new_score,
            level=level,
            trend=trend,
            last_interaction=datetime.utcnow(),
        )
        self._states[user_id] = new_state
        return new_state

    def describe_state(self, user_id: str) -> str:
        """Return a short human-readable description for prompts."""

        state = self._get_state(user_id)
        return (
            f"Affection level: {state.level.value} (score {state.score}/100, trend {state.trend}). "
            "Respond with warmth proportional to this level."
        )

    def get_state(self, user_id: str) -> AffectionState:
        return self._get_state(user_id)

    def load_from_db(self, user_id: str, score: int, level: str):
        """Initialize affection state from database."""
        self._states[user_id] = AffectionState(
            score=score,
            level=AffectionLevel(level),
            trend="steady",
            last_interaction=datetime.utcnow(),
        )

    def reset(self, user_id: str):
        self._states.pop(user_id, None)
