from __future__ import annotations

"""
LLM Integration for Mona

Handles OpenAI GPT API calls and conversation management.
"""

import os
from typing import List, Dict, Optional, AsyncGenerator
from openai import AsyncOpenAI
from pydantic import BaseModel

from personality import MonaPersonality, default_mona
from emotion import EmotionEngine
from memory import MemoryManager
from affection import AffectionEngine


class ConversationMessage(BaseModel):
    """A single message in the conversation history"""
    role: str  # "system", "user", or "assistant"
    content: str


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

        # Emotion engine per user
        self.emotion_engines: Dict[str, EmotionEngine] = {}
        self.memory_manager = MemoryManager()
        self.affection_engine = AffectionEngine()

    def _get_or_create_conversation(self, user_id: str) -> List[ConversationMessage]:
        """Get or create conversation history for a user"""
        if user_id not in self.conversations:
            # Initialize with system prompt
            emotion_state = self._get_emotion_engine(user_id).get_current_emotion()
            memory_context = self.memory_manager.build_context_block(user_id)
            affection_state = self.affection_engine.describe_state(user_id)
            system_prompt = self.personality.get_system_prompt(
                emotion_state,
                memory_context=memory_context,
                affection_state=affection_state,
            )

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
        """Update system prompt based on current emotion"""
        conversation = self.conversations[user_id]
        emotion_state = self._get_emotion_engine(user_id).get_current_emotion()
        memory_context = self.memory_manager.build_context_block(user_id)
        affection_state = self.affection_engine.describe_state(user_id)
        new_system_prompt = self.personality.get_system_prompt(
            emotion_state,
            memory_context=memory_context,
            affection_state=affection_state,
        )

        # Update the system message (always first in conversation)
        conversation[0] = ConversationMessage(role="system", content=new_system_prompt)

    async def stream_response(
        self,
        user_id: str,
        user_message: str,
    ) -> AsyncGenerator[Dict[str, object], None]:
        """Stream Mona's response chunks and final metadata."""

        conversation = self._get_or_create_conversation(user_id)

        emotion_engine = self._get_emotion_engine(user_id)
        emotion_engine.update_emotion(user_message)

        self.affection_engine.update_affection(user_id, user_message)
        self.memory_manager.process_user_message(user_id, user_message)

        self._update_system_prompt(user_id)

        conversation.append(ConversationMessage(role="user", content=user_message))

        if len(conversation) > self.max_history:
            conversation = [conversation[0]] + conversation[-(self.max_history - 1):]
            self.conversations[user_id] = conversation

        messages = [{"role": msg.role, "content": msg.content} for msg in conversation]

        assistant_message = ""

        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.9,
                max_tokens=200,
                presence_penalty=0.6,
                frequency_penalty=0.3,
                stream=True,
            )

            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if not delta or not delta.content:
                    continue
                assistant_message += delta.content
                yield {"event": "chunk", "content": delta.content}

            conversation.append(ConversationMessage(role="assistant", content=assistant_message))
            emotion_data = emotion_engine.get_emotion_for_expression()
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

    async def get_response(self, user_id: str, user_message: str) -> tuple[str, dict]:
        """Non-streaming helper kept for compatibility."""

        full_text = ""
        emotion: dict = {}
        async for event in self.stream_response(user_id, user_message):
            if event["event"] == "chunk":
                full_text += str(event.get("content", ""))
            elif event["event"] in {"complete", "error"}:
                full_text = str(event.get("content", "")) or full_text
                emotion = event.get("emotion", {}) or emotion
        return full_text, emotion

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
