"""Affection tracking for Mona.

Keeps a lightweight relationship score per user so responses can feel
consistent over time.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict

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

    def describe_state(self, user_id: str) -> str:
        """Return a short human-readable description for prompts."""

        state = self._get_state(user_id)
        return (
            f"Affection level: {state.level.value} (score {state.score}/100, trend {state.trend}). "
            "Respond with warmth proportional to this level."
        )

    def get_state(self, user_id: str) -> AffectionState:
        return self._get_state(user_id)

    def reset(self, user_id: str):
        self._states.pop(user_id, None)
