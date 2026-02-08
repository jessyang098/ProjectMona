from __future__ import annotations

"""
LLM Integration for Mona

Handles OpenAI GPT API calls and conversation management.
"""

import asyncio
import os
from datetime import datetime
from typing import List, Dict, Optional, AsyncGenerator
from openai import AsyncOpenAI
from pydantic import BaseModel

from personality import MonaPersonality, default_mona
from emotion import EmotionEngine, GestureType
from memory import MemoryManager
from affection import AffectionEngine
from analytics import analytics, calculate_llm_cost


# Available gestures for LLM selection
GESTURE_DESCRIPTIONS = """
Available gestures (choose the most appropriate one):
- wave: Greeting or saying hi/bye
- clapping: Celebrating, congratulating, excited about good news
- excited_jump: Very excited, can't contain excitement
- thinking: Pondering, considering something, curious
- looking_around: Curious, searching, wondering
- blush: Embarrassed, flustered, receiving compliment
- sad: Sad, sympathetic, bad news
- angry: Frustrated, annoyed, upset
- surprised: Shocked, surprised by something unexpected
- relax: Calm, content, peaceful moment
- sleepy: Tired, bored, drowsy
- none: No gesture needed (most common - use for normal conversation)
"""


class ConversationMessage(BaseModel):
    """A single message in the conversation history"""
    role: str  # "system", "user", or "assistant"
    content: str
    image_url: Optional[str] = None  # Base64 data URL for images


class MonaLLM:
    """Manages GPT API calls and conversation state"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gpt-4o-mini",
        personality: MonaPersonality = default_mona,
        max_history: int = 20
    ):
        """
        Initialize Mona's LLM integration

        Args:
            api_key: OpenAI API key (defaults to env var OPENAI_API_KEY)
            model: GPT model to use (gpt-4o-mini is cost-effective)
            personality: Mona's personality configuration
            max_history: Maximum conversation history to maintain
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key not provided. Set OPENAI_API_KEY environment variable.")

        self.client = AsyncOpenAI(api_key=self.api_key)
        self.model = model
        self.personality = personality
        self.max_history = max_history

        # Conversation history per user
        self.conversations: Dict[str, List[ConversationMessage]] = {}

        # User info (name, etc.) per user
        self.user_info: Dict[str, Dict[str, str]] = {}

        # Emotion engine per user
        self.emotion_engines: Dict[str, EmotionEngine] = {}
        self.memory_manager = MemoryManager()
        self.affection_engine = AffectionEngine()

    def set_user_info(self, user_id: str, name: str | None = None, nickname: str | None = None):
        """Set user info for personalized responses"""
        self.user_info[user_id] = {
            "name": nickname or name,  # Prefer nickname if set
        }
        # If conversation exists, update the system prompt with user info
        if user_id in self.conversations:
            self._update_system_prompt(user_id)

    def load_conversation_history(self, user_id: str, messages: list[dict]):
        """Load past conversation history from database for returning users.

        Args:
            user_id: The user's ID
            messages: List of dicts with 'role' ('user' or 'assistant') and 'content'
        """
        # Initialize conversation with system prompt first
        conversation = self._get_or_create_conversation(user_id)

        # Add past messages (limit to last N to avoid context overflow)
        recent_messages = messages[-self.max_history:] if len(messages) > self.max_history else messages
        for msg in recent_messages:
            conversation.append(ConversationMessage(
                role=msg["role"],
                content=msg["content"]
            ))

        print(f"📚 Loaded {len(recent_messages)} past messages for user {user_id}")

    def _get_user_name(self, user_id: str) -> str | None:
        """Get the user's name/nickname for this user_id"""
        info = self.user_info.get(user_id)
        return info.get("name") if info else None

    def _is_first_meeting(self, user_id: str) -> bool:
        """Check if this is the first interaction with this user.

        True when: no memories exist and fewer than 3 user messages in conversation.
        """
        has_memories = bool(self.memory_manager.get_recent_memories(user_id, limit=1))
        if has_memories:
            return False

        conversation = self.conversations.get(user_id, [])
        user_msg_count = sum(1 for m in conversation if m.role == "user")
        return user_msg_count < 3

    def _build_system_prompt(self, user_id: str) -> str:
        """Build the full system prompt including onboarding context if needed."""
        emotion_state = self._get_emotion_engine(user_id).get_current_emotion()
        memory_context = self.memory_manager.build_context_block(user_id)
        affection_state = self.affection_engine.describe_state(user_id)
        user_name = self._get_user_name(user_id)

        system_prompt = self.personality.get_system_prompt(
            emotion_state,
            memory_context=memory_context,
            affection_state=affection_state,
            user_name=user_name,
        )

        if self._is_first_meeting(user_id):
            system_prompt += """

FIRST MEETING: You're meeting this person for the first time. Introduce yourself naturally.
Ask what they'd like you to call them. Be curious about who they are. Don't overwhelm -
let your personality unfold over the first few messages. Make them want to come back."""

        return system_prompt

    def _get_or_create_conversation(self, user_id: str) -> List[ConversationMessage]:
        """Get or create conversation history for a user"""
        if user_id not in self.conversations:
            system_prompt = self._build_system_prompt(user_id)
            self.conversations[user_id] = [
                ConversationMessage(role="system", content=system_prompt)
            ]

        return self.conversations[user_id]

    def _get_emotion_engine(self, user_id: str) -> EmotionEngine:
        """Get or create emotion engine for a user"""
        if user_id not in self.emotion_engines:
            self.emotion_engines[user_id] = EmotionEngine()
        return self.emotion_engines[user_id]

    def _update_system_prompt(self, user_id: str):
        """Update system prompt based on current state"""
        conversation = self.conversations[user_id]
        conversation[0] = ConversationMessage(
            role="system", content=self._build_system_prompt(user_id)
        )

    async def _summarize_trimmed(
        self, user_id: str, trimmed: List[ConversationMessage]
    ):
        """Summarize trimmed conversation messages and store as memory."""
        try:
            transcript = "\n".join(
                f"{msg.role}: {msg.content}" for msg in trimmed if msg.content
            )
            if not transcript.strip():
                return

            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "Summarize this conversation excerpt in 2-3 sentences. "
                        "Focus on key topics discussed, decisions made, and emotional moments. "
                        "Write from a third-person perspective.",
                    },
                    {"role": "user", "content": transcript},
                ],
                temperature=0.3,
                max_tokens=150,
            )

            summary = response.choices[0].message.content
            if summary:
                from memory import MemoryCategory

                self.memory_manager.remember(
                    user_id,
                    f"Earlier conversation: {summary}",
                    category=MemoryCategory.FACT,
                    importance=40,
                    confidence=0.8,
                    key=f"conversation_summary_{int(datetime.now().timestamp())}",
                    value=summary,
                )
                print(f"📝 Stored conversation summary for {user_id[:8]}...")

        except Exception as e:
            print(f"⚠ Failed to summarize trimmed messages: {e}")

    async def stream_response(
        self,
        user_id: str,
        user_message: str,
        image_base64: Optional[str] = None,
        system_override: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, object], None]:
        """Stream Mona's response chunks and final metadata.

        Args:
            user_id: User identifier
            user_message: The user's message
            image_base64: Optional base64 image for vision
            system_override: Optional custom system prompt (for proactive messaging)
        """

        conversation = self._get_or_create_conversation(user_id)

        # If system_override provided, use temporary conversation with custom prompt
        if system_override:
            messages = [
                {"role": "system", "content": system_override},
                {"role": "user", "content": user_message},
            ]
            # Skip normal conversation flow, just generate
            assistant_message = ""
            usage_data = None

            try:
                stream = await self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=0.9,
                    max_tokens=100,  # Shorter for proactive messages
                    presence_penalty=0.6,
                    frequency_penalty=0.3,
                    stream=True,
                    stream_options={"include_usage": True},
                )

                async for chunk in stream:
                    if hasattr(chunk, 'usage') and chunk.usage:
                        usage_data = chunk.usage
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta
                    if not delta or not delta.content:
                        continue
                    assistant_message += delta.content
                    yield {"event": "chunk", "content": delta.content}

                # Track API cost
                if usage_data:
                    cost = calculate_llm_cost(
                        usage_data.prompt_tokens, usage_data.completion_tokens, self.model
                    )
                    await analytics.track_api_cost(
                        service="openai_chat",
                        model=self.model,
                        user_id=user_id.replace("proactive_", ""),  # Clean up ID
                        input_tokens=usage_data.prompt_tokens,
                        output_tokens=usage_data.completion_tokens,
                        estimated_cost=cost,
                    )

                yield {"event": "complete", "content": assistant_message, "emotion": {}}
                return

            except Exception as e:
                print(f"Error in proactive message generation: {e}")
                yield {"event": "error", "content": "", "emotion": {}}
                return

        emotion_engine = self._get_emotion_engine(user_id)
        emotion_engine.update_emotion(user_message)

        self.affection_engine.update_affection(user_id, user_message)
        self.memory_manager.process_user_message(user_id, user_message)

        self._update_system_prompt(user_id)

        # Add user message with optional image
        conversation.append(ConversationMessage(
            role="user",
            content=user_message,
            image_url=image_base64
        ))

        if len(conversation) > self.max_history:
            # Capture messages being trimmed (skip system prompt at index 0)
            trim_count = len(conversation) - self.max_history
            trimmed = conversation[1:1 + trim_count]

            conversation = [conversation[0]] + conversation[-(self.max_history - 1):]
            self.conversations[user_id] = conversation

            # Summarize trimmed messages in background
            if trimmed:
                asyncio.create_task(self._summarize_trimmed(user_id, trimmed))

        # Build messages for API - handle vision format for images
        messages = []
        for msg in conversation:
            if msg.image_url and msg.role == "user":
                # GPT-4o vision format: content is a list with text and image
                messages.append({
                    "role": msg.role,
                    "content": [
                        {"type": "text", "text": msg.content or "What do you see in this image?"},
                        {"type": "image_url", "image_url": {"url": msg.image_url}}
                    ]
                })
            else:
                messages.append({"role": msg.role, "content": msg.content})

        assistant_message = ""
        usage_data = None

        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.75,
                max_tokens=150,
                presence_penalty=0.5,
                frequency_penalty=0.4,
                stream=True,
                stream_options={"include_usage": True},
            )

            async for chunk in stream:
                # Capture usage from final chunk
                if hasattr(chunk, 'usage') and chunk.usage:
                    usage_data = chunk.usage
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if not delta or not delta.content:
                    continue
                assistant_message += delta.content
                yield {"event": "chunk", "content": delta.content}

            conversation.append(ConversationMessage(role="assistant", content=assistant_message))

            # Track API cost
            if usage_data:
                input_tokens = usage_data.prompt_tokens
                output_tokens = usage_data.completion_tokens
                cost = calculate_llm_cost(input_tokens, output_tokens, self.model)
                await analytics.track_api_cost(
                    service="openai_chat",
                    model=self.model,
                    user_id=user_id,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    estimated_cost=cost,
                )
            emotion_data = emotion_engine.get_emotion_for_expression()

            # After streaming completes, run LLM-based analysis in background
            # This refines emotion/affection/memory for the NEXT response
            _client = self.client
            _affection = self.affection_engine
            _memory = self.memory_manager
            _user_msg = user_message
            _assistant_msg = assistant_message
            _uid = user_id

            async def _post_response_analysis():
                try:
                    await emotion_engine.analyze_message_llm(_client, _user_msg, _assistant_msg)
                    await _affection.update_affection_llm(_client, _uid, _user_msg, _assistant_msg)
                    await _memory.extract_memories_llm(_client, _uid, _user_msg)
                except Exception as e:
                    print(f"⚠ Background analysis failed: {e}")

            asyncio.create_task(_post_response_analysis())

            # Check for direct gesture test command (test:wave, test:clapping, etc.)
            forced_gesture = self._check_gesture_test_command(user_message)
            if forced_gesture:
                emotion_data["gesture"] = forced_gesture
                print(f"🎬 TEST: Forced gesture: {forced_gesture}")
            else:
                # Use LLM to select the most appropriate gesture based on context
                selected_gesture = await self._select_gesture(
                    assistant_message,
                    user_message,
                    emotion_data.get("emotion", "neutral")
                )
                emotion_data["gesture"] = selected_gesture
                print(f"🎬 LLM selected gesture: {selected_gesture}")

            yield {
                "event": "complete",
                "content": assistant_message,
                "emotion": emotion_data,
            }

        except Exception as e:
            print(f"Error calling OpenAI API: {e}")
            fallback = "Sorry, I'm having trouble thinking right now... Can you say that again? 😅"
            conversation.append(ConversationMessage(role="assistant", content=fallback))
            yield {"event": "error", "content": fallback, "emotion": {}}

    async def get_response(
        self, user_id: str, user_message: str, image_base64: Optional[str] = None
    ) -> tuple[str, dict]:
        """Non-streaming helper kept for compatibility."""

        full_text = ""
        emotion: dict = {}
        async for event in self.stream_response(user_id, user_message, image_base64):
            if event["event"] == "chunk":
                full_text += str(event.get("content", ""))
            elif event["event"] in {"complete", "error"}:
                full_text = str(event.get("content", "")) or full_text
                emotion = event.get("emotion", {}) or emotion
        return full_text, emotion

    async def _select_gesture(self, mona_response: str, user_message: str, emotion: str) -> str:
        """
        Use a fast LLM call to select the most appropriate gesture for Mona's response.
        This runs in parallel with TTS generation to minimize latency.
        """
        try:
            prompt = f"""You are selecting a body gesture animation for a virtual girlfriend character.

User said: "{user_message}"
She responds: "{mona_response}"
Her current emotion: {emotion}

{GESTURE_DESCRIPTIONS}

IMPORTANT: Most normal conversation should use "none". Only use a gesture when it really fits.
- Greetings → wave
- Great news/celebration → clapping or excited_jump
- Thinking about something → thinking
- Embarrassed by compliment → blush
- Comforting sad news → sad
- Frustrated/annoyed → angry
- Shocked by something → surprised

Respond with ONLY the gesture name, nothing else."""

            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",  # Fast and cheap for this simple task
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=20,
            )

            # Track gesture selection cost
            if response.usage:
                cost = calculate_llm_cost(
                    response.usage.prompt_tokens,
                    response.usage.completion_tokens,
                    "gpt-4o-mini"
                )
                await analytics.track_api_cost(
                    service="openai_chat",
                    model="gpt-4o-mini",
                    input_tokens=response.usage.prompt_tokens,
                    output_tokens=response.usage.completion_tokens,
                    estimated_cost=cost,
                )

            gesture = response.choices[0].message.content.strip().lower()

            # Validate the gesture is in our list
            valid_gestures = [g.value for g in GestureType]
            if gesture in valid_gestures:
                return gesture

            # Default to none if invalid
            return "none"

        except Exception as e:
            print(f"Error selecting gesture: {e}")
            return "none"

    def _check_gesture_test_command(self, user_message: str) -> Optional[str]:
        """
        Check if message is a gesture test command (test:wave, test:clapping, etc.)
        Returns the gesture name if it's a valid test command, None otherwise.
        """
        message_lower = user_message.lower().strip()
        if not message_lower.startswith("test:"):
            return None

        gesture_name = message_lower.replace("test:", "").strip()

        # All valid gestures (matching GestureType enum values)
        valid_gestures = [g.value for g in GestureType]

        if gesture_name in valid_gestures:
            return gesture_name

        return None

    def clear_history(self, user_id: str):
        """Clear conversation history for a user"""
        if user_id in self.conversations:
            del self.conversations[user_id]
        if user_id in self.emotion_engines:
            self.emotion_engines[user_id].reset()
        self.affection_engine.reset(user_id)
        self.memory_manager.clear(user_id)

    def get_emotion_state(self, user_id: str) -> dict:
        """Get current emotion state for a user"""
        emotion_engine = self._get_emotion_engine(user_id)
        return emotion_engine.get_emotion_for_expression()

    def get_pending_memories(self, user_id: str):
        """Get memories that need to be saved to database."""
        return self.memory_manager.get_pending_memories(user_id)

    def get_pending_deprecations(self, user_id: str):
        """Get memory keys that need to be deprecated in database."""
        return self.memory_manager.get_pending_deprecations(user_id)

    def deprecate_memory(self, user_id: str, key: str):
        """Deprecate a memory in the in-memory cache."""
        self.memory_manager.deprecate_by_key(user_id, key)

    def load_memories(self, user_id: str, db_memories: list[dict]):
        """Load memories from database records."""
        self.memory_manager.load_from_db_records(user_id, db_memories)

    def load_affection(self, user_id: str, score: int, level: str):
        """Initialize affection state from persisted database values."""
        self.affection_engine.load_from_db(user_id, score, level)

    def get_affection_for_save(self, user_id: str) -> tuple[int, str] | None:
        """Get current affection state for database persistence."""
        state = self.affection_engine.get_state(user_id)
        if state:
            return (state.score, state.level.value)
        return None
