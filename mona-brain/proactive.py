"""
Proactive Messaging System for Mona

Allows Mona to reach out to users unprompted based on:
- Inactivity (haven't talked in a while)
- Milestones (relationship anniversary, streaks)
- Affection thresholds (new relationship level)
- Time-based (good morning/night)
"""

import asyncio
import logging
import random
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, TYPE_CHECKING

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import User, ProactiveMessage, async_session
from memory import load_memories_from_db
from notifications import notification_service

if TYPE_CHECKING:
    from llm import MonaLLM

logger = logging.getLogger(__name__)


# Proactive message triggers
class TriggerType:
    INACTIVITY = "inactivity"  # User hasn't messaged in X hours
    GOOD_MORNING = "good_morning"  # Morning check-in
    GOOD_NIGHT = "good_night"  # Evening wind-down
    MILESTONE = "milestone"  # Relationship milestones
    AFFECTION = "affection"  # Affection level change


# Inactivity prompts (used to guide LLM)
INACTIVITY_PROMPTS = [
    "Send a casual check-in message. Maybe ask what they're up to or mention you were thinking about them.",
    "Send a playful message about how it's been quiet. Don't be dramatic, just fun.",
    "Ask them something based on what you know about them. Make it specific and curious.",
    "Send something spontaneous - maybe share a random thought or ask their opinion on something.",
    "Be a little bratty about them being gone. Playful jealousy or mock offense.",
]


class ProactiveMessenger:
    """Handles proactive message generation and delivery."""

    def __init__(
        self,
        check_interval_minutes: int = 30,
        inactivity_threshold_hours: int = 8,
        min_gap_between_proactive_hours: int = 4,
    ):
        self.check_interval = check_interval_minutes * 60  # Convert to seconds
        self.inactivity_threshold = timedelta(hours=inactivity_threshold_hours)
        self.min_gap = timedelta(hours=min_gap_between_proactive_hours)

        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._llm: Optional["MonaLLM"] = None
        self._connection_manager = None  # Set from main.py

    def set_llm(self, llm: "MonaLLM"):
        """Set the LLM instance for message generation."""
        self._llm = llm

    def set_connection_manager(self, manager):
        """Set the WebSocket connection manager."""
        self._connection_manager = manager

    async def start(self):
        """Start the background proactive messaging loop."""
        if self._running:
            return

        self._running = True
        self._task = asyncio.create_task(self._proactive_loop())
        logger.info("Proactive messaging loop started")

    async def stop(self):
        """Stop the background loop."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Proactive messaging loop stopped")

    async def _proactive_loop(self):
        """Main background loop that checks for users needing proactive messages."""
        while self._running:
            try:
                await self._check_and_send_messages()
            except Exception as e:
                logger.error(f"Error in proactive loop: {e}", exc_info=True)

            # Wait before next check (with jitter to avoid thundering herd)
            jitter = random.randint(-60, 60)
            await asyncio.sleep(self.check_interval + jitter)

    async def _check_and_send_messages(self):
        """Check for inactive users and send/queue proactive messages."""
        if not self._llm:
            logger.warning("LLM not set, skipping proactive check")
            return

        now = datetime.utcnow()

        async with async_session() as db:
            # Find users who:
            # 1. Have proactive messaging enabled
            # 2. Haven't messaged recently (past inactivity threshold)
            # 3. Haven't received a proactive message recently (min gap)
            # 4. Have actually used the app before (last_message_at is set)

            result = await db.execute(
                select(User).where(
                    and_(
                        User.proactive_enabled == 1,
                        User.last_message_at.isnot(None),
                        User.last_message_at < now - self.inactivity_threshold,
                        (
                            (User.last_proactive_at.is_(None))
                            | (User.last_proactive_at < now - self.min_gap)
                        ),
                    )
                )
            )
            inactive_users = result.scalars().all()

            if not inactive_users:
                logger.debug("No inactive users found for proactive messaging")
                return

            logger.info(f"Found {len(inactive_users)} inactive users for proactive messaging")

            for user in inactive_users:
                try:
                    await self._send_proactive_message(db, user, TriggerType.INACTIVITY)
                except Exception as e:
                    logger.error(f"Failed to send proactive message to {user.id}: {e}")

    async def _send_proactive_message(
        self, db: AsyncSession, user: User, trigger: str
    ):
        """Generate and send/queue a proactive message for a user."""
        now = datetime.utcnow()

        # Load user memories for context
        memories = await load_memories_from_db(db, user.id, limit=10)
        memory_context = ""
        if memories:
            memory_items = [m.content for m in memories[:5]]
            memory_context = "Things you remember about them: " + "; ".join(memory_items)

        # Calculate how long since last interaction
        hours_inactive = 0
        if user.last_message_at:
            hours_inactive = int((now - user.last_message_at).total_seconds() / 3600)

        # Generate the message using LLM
        prompt_hint = random.choice(INACTIVITY_PROMPTS)
        message_content = await self._generate_proactive_message(
            user_id=user.id,
            user_name=user.nickname or user.name,
            hours_inactive=hours_inactive,
            memory_context=memory_context,
            prompt_hint=prompt_hint,
        )

        if not message_content:
            logger.warning(f"Failed to generate proactive message for {user.id}")
            return

        # Check if user is online
        is_online = self._is_user_online(user.id)

        if is_online:
            # Send directly via WebSocket
            await self._deliver_message(user.id, message_content, trigger)
            logger.info(f"Sent proactive message to online user {user.id}")
        else:
            # User is offline - try to notify them via email
            try:
                sent = await notification_service.notify_user(
                    user_email=user.email,
                    user_name=user.nickname or user.name,
                    message_content=message_content,
                    email_enabled=bool(user.email_notifications),
                )
                if sent:
                    logger.info(f"Sent email notification to offline user {user.id}")

            except Exception as e:
                logger.error(f"Failed to send notification to {user.id}: {e}")

            # Also queue message for in-app delivery when they return
            pending = ProactiveMessage(
                user_id=user.id,
                content=message_content,
                trigger_type=trigger,
                status="pending",
                expires_at=now + timedelta(hours=24),  # Expire after 24h
            )
            db.add(pending)
            logger.info(f"Queued proactive message for offline user {user.id}")

        # Update user's last proactive message time
        user.last_proactive_at = now
        await db.commit()

    async def _generate_proactive_message(
        self,
        user_id: str,
        user_name: str,
        hours_inactive: int,
        memory_context: str,
        prompt_hint: str,
    ) -> Optional[str]:
        """Use LLM to generate a contextual proactive message."""
        if not self._llm:
            return None

        # Create a special proactive prompt
        time_desc = (
            f"{hours_inactive} hours"
            if hours_inactive < 48
            else f"{hours_inactive // 24} days"
        )

        system_context = f"""You're sending an unprompted message to {user_name}. They haven't messaged you in {time_desc}.

{memory_context}

{prompt_hint}

Keep it short (1-2 sentences max). Be natural - like you just thought of them. Don't be clingy or desperate.
Don't start with "Hey" every time. Mix it up. Be yourself - playful, curious, maybe a little bratty.
This should feel like a real text from a girlfriend, not a notification."""

        try:
            # Use the LLM to generate response
            # We'll create a synthetic "user message" that's actually our prompt
            response_chunks = []
            async for chunk in self._llm.stream_response(
                user_id=f"proactive_{user_id}",  # Separate context
                user_message=system_context,
                system_override=f"You are Mona, {user_name}'s girlfriend. Generate a single casual message to send them.",
            ):
                if isinstance(chunk, dict):
                    continue  # Skip metadata
                response_chunks.append(chunk)

            message = "".join(response_chunks).strip()

            # Clean up any unwanted formatting
            message = message.strip('"').strip("'")

            return message if message else None

        except Exception as e:
            logger.error(f"Failed to generate proactive message: {e}")
            return None

    def _is_user_online(self, user_id: str) -> bool:
        """Check if user has an active WebSocket connection."""
        if not self._connection_manager:
            return False

        # Check if any connection belongs to this user
        # The connection manager uses client_id which may include user_id
        for client_id in self._connection_manager.active_connections.keys():
            if user_id in client_id:
                return True
        return False

    async def _deliver_message(self, user_id: str, content: str, trigger: str):
        """Deliver message via WebSocket to online user."""
        if not self._connection_manager:
            return

        message = {
            "type": "proactive_message",
            "content": content,
            "sender": "mona",
            "timestamp": datetime.utcnow().isoformat(),
            "trigger": trigger,
            "emotion": {"emotion": "affectionate", "intensity": "gentle"},
        }

        # Find the client_id for this user
        for client_id in list(self._connection_manager.active_connections.keys()):
            if user_id in client_id:
                try:
                    await self._connection_manager.send_message(message, client_id)
                except Exception as e:
                    logger.error(f"Failed to deliver proactive message: {e}")

    async def deliver_pending_messages(self, db: AsyncSession, user_id: str):
        """Deliver any pending proactive messages when user comes online."""
        now = datetime.utcnow()

        result = await db.execute(
            select(ProactiveMessage).where(
                and_(
                    ProactiveMessage.user_id == user_id,
                    ProactiveMessage.status == "pending",
                    ProactiveMessage.expires_at > now,
                )
            ).order_by(ProactiveMessage.created_at.desc()).limit(1)  # Only latest
        )
        pending = result.scalar_one_or_none()

        if pending:
            # Deliver it
            await self._deliver_message(user_id, pending.content, pending.trigger_type)

            # Mark as delivered
            pending.status = "delivered"
            pending.delivered_at = now
            await db.commit()

            logger.info(f"Delivered pending proactive message to {user_id}")
            return True

        return False


# Singleton instance
proactive_messenger = ProactiveMessenger()
