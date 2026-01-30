"""Memory management for Mona.

Stores lightweight user memories so the LLM can reference stable facts,
preferences, and recent events when generating responses.
"""

from __future__ import annotations

import re
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class MemoryCategory(str, Enum):
    """Types of memories Mona can store."""

    FACT = "fact"
    PREFERENCE = "preference"
    EVENT = "event"
    FEELING = "feeling"
    OTHER = "other"


class MemoryItem(BaseModel):
    """A single piece of remembered information."""

    content: str
    category: MemoryCategory = MemoryCategory.OTHER
    importance: int = Field(default=50, ge=0, le=100)
    tags: List[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    def to_bullet(self) -> str:
        """Format the memory as a short bullet for prompts."""

        tag_text = f" ({', '.join(self.tags)})" if self.tags else ""
        return f"- [{self.category}] {self.content}{tag_text}"


class MemoryManager:
    """In-memory store of user memories with simple heuristics."""

    def __init__(self, max_memories_per_user: int = 40):
        self.max_memories_per_user = max_memories_per_user
        self._memories: Dict[str, List[MemoryItem]] = {}
        self._pending_save: Dict[str, List[MemoryItem]] = {}  # Memories needing DB save

    def _get_user_memories(self, user_id: str) -> List[MemoryItem]:
        return self._memories.setdefault(user_id, [])

    def remember(
        self,
        user_id: str,
        content: str,
        *,
        category: MemoryCategory = MemoryCategory.OTHER,
        importance: int = 50,
        tags: Optional[List[str]] = None,
        from_db: bool = False,
    ) -> MemoryItem:
        """Persist a new memory item for the given user."""

        memory = MemoryItem(
            content=content.strip(),
            category=category,
            importance=importance,
            tags=tags or [],
        )
        memories = self._get_user_memories(user_id)
        memories.append(memory)

        # Track new memories that need to be saved to DB
        if not from_db:
            if user_id not in self._pending_save:
                self._pending_save[user_id] = []
            self._pending_save[user_id].append(memory)

        # Keep the list bounded by trimming the least important/oldest.
        if len(memories) > self.max_memories_per_user:
            memories.sort(key=lambda item: (item.importance, item.timestamp))
            memories.pop(0)
        return memory

    def get_pending_memories(self, user_id: str) -> List[MemoryItem]:
        """Get memories that need to be saved to DB, and clear the pending list."""
        pending = self._pending_save.pop(user_id, [])
        return pending

    def process_user_message(self, user_id: str, message: str) -> List[MemoryItem]:
        """Extract potential memories from a raw user message."""

        message = message.strip()
        if not message:
            return []

        memories: List[MemoryItem] = []
        lowered = message.lower()

        # Simple name/introduction detection
        name_match = re.search(r"my name is ([a-zA-Z ']+)", lowered)
        if name_match:
            name = name_match.group(1).strip().title()
            memories.append(
                self.remember(
                    user_id,
                    f"User's name is {name}.",
                    category=MemoryCategory.FACT,
                    importance=90,
                    tags=["identity"],
                )
            )

        # Preferences like "I like" or "my favorite"
        pref_match = re.search(r"i (really )?like ([^.!?]+)", lowered)
        if pref_match:
            preference = pref_match.group(2).strip()
            memories.append(
                self.remember(
                    user_id,
                    f"User likes {preference}.",
                    category=MemoryCategory.PREFERENCE,
                    importance=75,
                    tags=["preference"],
                )
            )

        favorite_match = re.search(r"my favorite ([^ ]+) is ([^.!?]+)", lowered)
        if favorite_match:
            thing = favorite_match.group(1)
            favorite = favorite_match.group(2).strip()
            memories.append(
                self.remember(
                    user_id,
                    f"User's favorite {thing} is {favorite}.",
                    category=MemoryCategory.PREFERENCE,
                    importance=80,
                    tags=["favorite"],
                )
            )

        # Events signaled by "I went" / "I just"
        if "i went" in lowered or "i just" in lowered:
            memories.append(
                self.remember(
                    user_id,
                    f"User said: '{message}'.",
                    category=MemoryCategory.EVENT,
                    importance=60,
                    tags=["recent"],
                )
            )

        # Feelings ("I'm feeling", "I'm sad")
        feeling_match = re.search(r"i'?m feeling ([^.!?]+)", lowered)
        if feeling_match:
            feeling = feeling_match.group(1).strip()
            memories.append(
                self.remember(
                    user_id,
                    f"User is feeling {feeling}.",
                    category=MemoryCategory.FEELING,
                    importance=70,
                    tags=["emotion"],
                )
            )

        # If nothing specific matched, optionally store the raw message as a low-importance note.
        if not memories:
            memories.append(
                self.remember(
                    user_id,
                    f"User said: '{message}'.",
                    category=MemoryCategory.OTHER,
                    importance=30,
                )
            )

        return memories

    def get_recent_memories(self, user_id: str, limit: int = 5) -> List[MemoryItem]:
        """Return the most recent memories for a user."""

        memories = self._memories.get(user_id, [])
        return memories[-limit:]

    def build_context_block(self, user_id: str, limit: int = 5) -> str:
        """Create a bullet list suitable for LLM system prompts."""

        memories = self.get_recent_memories(user_id, limit)
        if not memories:
            return ""
        bullets = [memory.to_bullet() for memory in memories]
        return "\n".join(bullets)

    def clear(self, user_id: str):
        """Forget everything about a user (used when clearing history)."""

        self._memories.pop(user_id, None)

    def load_from_db_records(self, user_id: str, db_memories: List[dict]):
        """Load memories from database records into the in-memory cache."""
        memories = self._get_user_memories(user_id)
        for record in db_memories:
            memory = MemoryItem(
                content=record["content"],
                category=MemoryCategory(record["category"]),
                importance=record["importance"],
                timestamp=record["created_at"],
            )
            memories.append(memory)


# Database persistence functions (called from main.py)

async def save_memory_to_db(db, user_id: str, memory: MemoryItem):
    """Save a memory item to the database."""
    from database import UserMemory

    db_memory = UserMemory(
        user_id=user_id,
        content=memory.content,
        category=memory.category.value,
        importance=memory.importance,
    )
    db.add(db_memory)
    await db.commit()


async def load_memories_from_db(db, user_id: str, limit: int = 20) -> List[dict]:
    """Load memories from database for a user."""
    from sqlalchemy import select
    from database import UserMemory

    result = await db.execute(
        select(UserMemory)
        .where(UserMemory.user_id == user_id)
        .order_by(UserMemory.importance.desc(), UserMemory.created_at.desc())
        .limit(limit)
    )
    records = result.scalars().all()
    return [
        {
            "content": r.content,
            "category": r.category,
            "importance": r.importance,
            "created_at": r.created_at,
        }
        for r in records
    ]
