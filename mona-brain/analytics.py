"""
Analytics module for Mona backend.
Tracks essential user events via PostHog and API costs in database.
"""
import os
import logging
import posthog
from database import APIUsage, async_session

logger = logging.getLogger(__name__)


# API pricing reference (per 1K tokens/characters)
PRICING = {
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "whisper-1": {"per_minute": 0.006},
    "tts-1": {"per_1k_chars": 0.015},
    "fish": {"per_1k_chars": 0.01},
    "cartesia": {"per_1k_chars": 0.02},
}


class Analytics:
    """Minimal analytics - only essential events."""

    # Only 4 user events
    EVENT_SIGNUP = "signup"
    EVENT_LOGIN = "login"
    EVENT_MESSAGE_SENT = "message_sent"
    EVENT_VOICE_USED = "voice_used"

    def __init__(self):
        api_key = os.getenv("POSTHOG_API_KEY")
        if api_key:
            posthog.api_key = api_key
            posthog.host = os.getenv("POSTHOG_HOST", "https://app.posthog.com")
            self.enabled = True
            logger.info("PostHog analytics enabled")
        else:
            self.enabled = False
            logger.warning("POSTHOG_API_KEY not set - analytics disabled")

    def track(self, event_type: str, user_id: str = None, properties: dict = None):
        """Send event to PostHog."""
        if not self.enabled:
            return
        distinct_id = str(user_id) if user_id else "anonymous"
        posthog.capture(distinct_id, event_type, properties or {})
        logger.info(f"Analytics: {event_type} | user={user_id}")

    def identify(self, user_id: str, traits: dict):
        """Identify user with traits (email, signup_date, etc)."""
        if not self.enabled:
            return
        posthog.identify(str(user_id), traits)
        logger.info(f"Analytics: identify | user={user_id}")

    async def track_api_cost(
        self,
        service: str,
        model: str = None,
        user_id: str = None,
        guest_session_id: str = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        characters: int = 0,
        estimated_cost: float = 0.0,
    ):
        """Track API costs in database for unit economics."""
        async with async_session() as session:
            usage = APIUsage(
                user_id=user_id,
                guest_session_id=guest_session_id,
                service=service,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                characters=characters,
                estimated_cost_usd=estimated_cost,
            )
            session.add(usage)
            await session.commit()
        logger.debug(f"API cost: {service} ${estimated_cost:.4f} | user={user_id or guest_session_id}")


def calculate_llm_cost(input_tokens: int, output_tokens: int, model: str = "gpt-4o-mini") -> float:
    """Calculate cost for LLM API call."""
    pricing = PRICING.get(model, PRICING["gpt-4o-mini"])
    input_cost = (input_tokens / 1000) * pricing["input"]
    output_cost = (output_tokens / 1000) * pricing["output"]
    return input_cost + output_cost


def calculate_tts_cost(characters: int, service: str = "tts-1") -> float:
    """Calculate cost for TTS API call."""
    if service == "sovits":
        return 0.0  # Self-hosted, no API cost
    pricing = PRICING.get(service, {"per_1k_chars": 0.015})
    return (characters / 1000) * pricing.get("per_1k_chars", 0.015)


# Singleton instance
analytics = Analytics()
