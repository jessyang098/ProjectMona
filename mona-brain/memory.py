"""Memory management for Mona.

Stores lightweight user memories so the LLM can reference stable facts,
preferences, and recent events when generating responses.

v1.5: Adds deduplication, TTL for ephemeral data, uncertainty filtering,
and confidence scoring.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta
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


# TTL configuration for ephemeral memories
CATEGORY_TTL: Dict[MemoryCategory, Optional[timedelta]] = {
    MemoryCategory.FACT: None,  # Durable, no expiry
    MemoryCategory.PREFERENCE: None,  # Durable, can be overwritten
    MemoryCategory.EVENT: timedelta(days=7),  # Ephemeral
    MemoryCategory.FEELING: timedelta(hours=6),  # Ephemeral
    MemoryCategory.OTHER: timedelta(days=1),  # Short-lived
}

# Patterns that indicate uncertainty - don't extract as facts
UNCERTAIN_PATTERNS = [
    r"\b(might|maybe|probably|perhaps|thinking about|could|would|should|if)\b",
    r"\?$",  # Questions
    r"\bi think\b",
    r"\bi guess\b",
    r"\bnot sure\b",
]


def is_uncertain(message: str) -> bool:
    """Check if a message contains uncertainty markers."""
    return any(re.search(p, message, re.I) for p in UNCERTAIN_PATTERNS)


def get_ttl_for_category(category: MemoryCategory) -> Optional[timedelta]:
    """Get the TTL for a memory category."""
    return CATEGORY_TTL.get(category)


def calculate_expiry(category: MemoryCategory) -> Optional[datetime]:
    """Calculate expiry datetime based on category TTL."""
    ttl = get_ttl_for_category(category)
    if ttl is None:
        return None
    return datetime.utcnow() + ttl


def normalize_value(value: str) -> str:
    """Normalize a value for deduplication comparison."""
    # Lowercase, strip punctuation, collapse whitespace
    normalized = value.lower().strip()
    normalized = re.sub(r"[^\w\s]", "", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


class MemoryItem(BaseModel):
    """A single piece of remembered information."""

    content: str
    category: MemoryCategory = MemoryCategory.OTHER
    importance: int = Field(default=50, ge=0, le=100)
    confidence: float = Field(default=0.7, ge=0.0, le=1.0)
    tags: List[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # v1.5 fields for deduplication and lifecycle
    key: Optional[str] = None  # e.g., "name", "favorite_food", "likes:pizza"
    value: Optional[str] = None  # normalized value for comparison
    status: str = "active"  # active, deprecated
    expires_at: Optional[datetime] = None

    def to_bullet(self) -> str:
        """Format the memory as a short bullet for prompts."""
        tag_text = f" ({', '.join(self.tags)})" if self.tags else ""
        return f"- [{self.category.value}] {self.content}{tag_text}"

    def is_expired(self) -> bool:
        """Check if this memory has expired."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at


class MemoryManager:
    """In-memory store of user memories with deduplication and TTL support."""

    def __init__(self, max_memories_per_user: int = 40):
        self.max_memories_per_user = max_memories_per_user
        self._memories: Dict[str, List[MemoryItem]] = {}
        self._pending_save: Dict[str, List[MemoryItem]] = {}  # Memories needing DB save
        self._pending_deprecate: Dict[str, List[str]] = {}  # Keys to deprecate in DB

    def _get_user_memories(self, user_id: str) -> List[MemoryItem]:
        return self._memories.setdefault(user_id, [])

    def _find_existing_by_key(self, user_id: str, key: str) -> Optional[MemoryItem]:
        """Find an existing active memory with the same key."""
        memories = self._get_user_memories(user_id)
        for mem in memories:
            if mem.key == key and mem.status == "active":
                return mem
        return None

    def _deprecate_memory(self, user_id: str, memory: MemoryItem):
        """Mark a memory as deprecated."""
        memory.status = "deprecated"
        # Track for DB update
        if memory.key:
            if user_id not in self._pending_deprecate:
                self._pending_deprecate[user_id] = []
            self._pending_deprecate[user_id].append(memory.key)

    def remember(
        self,
        user_id: str,
        content: str,
        *,
        category: MemoryCategory = MemoryCategory.OTHER,
        importance: int = 50,
        confidence: float = 0.7,
        tags: Optional[List[str]] = None,
        key: Optional[str] = None,
        value: Optional[str] = None,
        from_db: bool = False,
        expires_at: Optional[datetime] = None,
    ) -> Optional[MemoryItem]:
        """Persist a new memory item for the given user.

        Returns None if the memory was deduplicated (already exists with same value).
        """
        # Calculate expiry if not provided
        if expires_at is None:
            expires_at = calculate_expiry(category)

        # Normalize value for comparison
        normalized_value = normalize_value(value) if value else None

        # Check for deduplication if we have a key
        if key and not from_db:
            existing = self._find_existing_by_key(user_id, key)
            if existing:
                existing_normalized = normalize_value(existing.value) if existing.value else None
                if existing_normalized == normalized_value:
                    # Same key and same value - just bump importance if higher
                    if importance > existing.importance:
                        existing.importance = importance
                    return None  # Don't create duplicate
                else:
                    # Same key but different value - deprecate old, create new
                    self._deprecate_memory(user_id, existing)

        memory = MemoryItem(
            content=content.strip(),
            category=category,
            importance=importance,
            confidence=confidence,
            tags=tags or [],
            key=key,
            value=value,
            expires_at=expires_at,
        )
        memories = self._get_user_memories(user_id)
        memories.append(memory)

        # Track new memories that need to be saved to DB
        if not from_db:
            if user_id not in self._pending_save:
                self._pending_save[user_id] = []
            self._pending_save[user_id].append(memory)

        # Keep the list bounded by trimming the least important/oldest
        if len(memories) > self.max_memories_per_user:
            # Filter out deprecated and expired first
            active_memories = [m for m in memories if m.status == "active" and not m.is_expired()]
            if len(active_memories) > self.max_memories_per_user:
                active_memories.sort(key=lambda item: (item.importance, item.timestamp))
                active_memories.pop(0)
            # Keep deprecated for history but limit total
            self._memories[user_id] = active_memories

        return memory

    def get_pending_memories(self, user_id: str) -> List[MemoryItem]:
        """Get memories that need to be saved to DB, and clear the pending list."""
        pending = self._pending_save.pop(user_id, [])
        return pending

    def get_pending_deprecations(self, user_id: str) -> List[str]:
        """Get keys that need to be deprecated in DB, and clear the pending list."""
        pending = self._pending_deprecate.pop(user_id, [])
        return pending

    def process_user_message(self, user_id: str, message: str) -> List[MemoryItem]:
        """Extract potential memories from a raw user message.

        v1.5: Adds uncertainty filtering and key-based extraction.
        """
        message = message.strip()
        if not message:
            return []

        # Skip uncertain statements for durable facts
        uncertain = is_uncertain(message)

        memories: List[MemoryItem] = []
        lowered = message.lower()

        # Name extraction (high confidence, durable)
        name_match = re.search(r"my name is ([a-zA-Z ']+)", lowered)
        if name_match and not uncertain:
            name = name_match.group(1).strip().title()
            mem = self.remember(
                user_id,
                f"User's name is {name}.",
                category=MemoryCategory.FACT,
                importance=90,
                confidence=0.9,
                tags=["identity"],
                key="name",
                value=name,
            )
            if mem:
                memories.append(mem)

        # "My favorite X is Y" (high confidence preference)
        favorite_match = re.search(r"my favorite ([^\s]+) is ([^.!?]+)", lowered)
        if favorite_match and not uncertain:
            thing = favorite_match.group(1).strip()
            favorite = favorite_match.group(2).strip()
            mem = self.remember(
                user_id,
                f"User's favorite {thing} is {favorite}.",
                category=MemoryCategory.PREFERENCE,
                importance=80,
                confidence=0.8,
                tags=["favorite"],
                key=f"favorite_{thing}",
                value=favorite,
            )
            if mem:
                memories.append(mem)

        # "I like X" preference (medium confidence)
        pref_match = re.search(r"i (really )?like ([^.!?]+)", lowered)
        if pref_match and not uncertain:
            preference = pref_match.group(2).strip()
            # Create a key based on what they like
            pref_key = f"likes:{normalize_value(preference)[:30]}"
            mem = self.remember(
                user_id,
                f"User likes {preference}.",
                category=MemoryCategory.PREFERENCE,
                importance=75,
                confidence=0.7,
                tags=["preference"],
                key=pref_key,
                value=preference,
            )
            if mem:
                memories.append(mem)

        # "I hate/dislike X" (medium confidence)
        dislike_match = re.search(r"i (really )?(hate|dislike|can't stand) ([^.!?]+)", lowered)
        if dislike_match and not uncertain:
            dislike = dislike_match.group(3).strip()
            dislike_key = f"dislikes:{normalize_value(dislike)[:30]}"
            mem = self.remember(
                user_id,
                f"User dislikes {dislike}.",
                category=MemoryCategory.PREFERENCE,
                importance=75,
                confidence=0.7,
                tags=["preference"],
                key=dislike_key,
                value=dislike,
            )
            if mem:
                memories.append(mem)

        # Events - "I went" / "I just" (ephemeral, lower confidence)
        if ("i went" in lowered or "i just" in lowered) and not uncertain:
            mem = self.remember(
                user_id,
                f"User said: '{message}'.",
                category=MemoryCategory.EVENT,
                importance=60,
                confidence=0.6,
                tags=["recent"],
                # No key - events don't dedupe by key
            )
            if mem:
                memories.append(mem)

        # NOTE: Feelings are NOT extracted - handled message-by-message by LLM
        # Storing feelings risks stale/wrong emotions being referenced

        # Birthday extraction (allowed per user preference)
        birthday_match = re.search(
            r"(?:my birthday is|i was born on|born on|my bday is) ([^.!?]+)", lowered
        )
        if birthday_match and not uncertain:
            birthday = birthday_match.group(1).strip()
            mem = self.remember(
                user_id,
                f"User's birthday is {birthday}.",
                category=MemoryCategory.FACT,
                importance=85,
                confidence=0.9,
                tags=["identity"],
                key="birthday",
                value=birthday,
            )
            if mem:
                memories.append(mem)

        # NOTE: We intentionally do NOT extract PII like:
        # - Workplace/employer names
        # - Location/address
        # Birthday IS allowed (extracted above).

        # Don't store low-importance "user said" for every message
        # Only store if nothing specific was extracted AND message seems significant
        # (This reduces noise significantly)

        return memories

    def get_recent_memories(self, user_id: str, limit: int = 5) -> List[MemoryItem]:
        """Return the most recent active, non-expired memories for a user."""
        memories = self._memories.get(user_id, [])
        # Filter to active, non-expired
        active = [m for m in memories if m.status == "active" and not m.is_expired()]
        return active[-limit:]

    def get_memories_by_relevance(
        self, user_id: str, message: str, limit: int = 5
    ) -> List[MemoryItem]:
        """Get memories most relevant to the current message.

        Uses keyword overlap + importance + recency for scoring.
        """
        memories = self._memories.get(user_id, [])
        active = [m for m in memories if m.status == "active" and not m.is_expired()]

        if not active:
            return []

        message_words = set(message.lower().split())
        now = datetime.utcnow()

        def score_memory(mem: MemoryItem) -> float:
            memory_words = set(mem.content.lower().split())
            overlap = len(message_words & memory_words)

            # Recency boost (memories used in last 7 days get bonus)
            days_old = (now - mem.timestamp).days
            recency_score = max(0, 1 - (days_old / 30))  # Decay over 30 days

            return (
                (overlap * 0.3)
                + (mem.importance / 100 * 0.4)
                + (recency_score * 0.2)
                + (mem.confidence * 0.1)
            )

        scored = [(score_memory(m), m) for m in active]
        scored.sort(key=lambda x: x[0], reverse=True)

        return [m for _, m in scored[:limit]]

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
        now = datetime.utcnow()

        for record in db_memories:
            # Skip expired memories
            expires_at = record.get("expires_at")
            if expires_at and expires_at < now:
                continue

            # Skip deprecated memories
            status = record.get("status", "active")
            if status != "active":
                continue

            memory = MemoryItem(
                content=record["content"],
                category=MemoryCategory(record["category"]),
                importance=record["importance"],
                confidence=record.get("confidence", 0.7),
                timestamp=record["created_at"],
                key=record.get("key"),
                value=record.get("value"),
                status=status,
                expires_at=expires_at,
            )
            memories.append(memory)


# Database persistence functions (called from main.py)


async def save_memory_to_db(db, user_id: str, memory: MemoryItem):
    """Save a memory item to the database."""
    from database import UserMemory

    db_memory = UserMemory(
        user_id=user_id,
        key=memory.key,
        value=memory.value,
        content=memory.content,
        category=memory.category.value,
        importance=memory.importance,
        confidence=memory.confidence,
        status=memory.status,
        expires_at=memory.expires_at,
    )
    db.add(db_memory)
    await db.commit()


async def deprecate_memories_by_key(db, user_id: str, keys: List[str]):
    """Mark memories with given keys as deprecated in the database."""
    if not keys:
        return

    from sqlalchemy import update
    from database import UserMemory

    await db.execute(
        update(UserMemory)
        .where(UserMemory.user_id == user_id)
        .where(UserMemory.key.in_(keys))
        .where(UserMemory.status == "active")
        .values(status="deprecated")
    )
    await db.commit()


async def load_memories_from_db(db, user_id: str, limit: int = 20) -> List[dict]:
    """Load active, non-expired memories from database for a user."""
    from sqlalchemy import select, or_
    from database import UserMemory

    now = datetime.utcnow()

    result = await db.execute(
        select(UserMemory)
        .where(UserMemory.user_id == user_id)
        .where(UserMemory.status == "active")
        .where(or_(UserMemory.expires_at.is_(None), UserMemory.expires_at > now))
        .order_by(UserMemory.importance.desc(), UserMemory.created_at.desc())
        .limit(limit)
    )
    records = result.scalars().all()
    return [
        {
            "content": r.content,
            "category": r.category,
            "importance": r.importance,
            "confidence": r.confidence,
            "key": r.key,
            "value": r.value,
            "status": r.status,
            "expires_at": r.expires_at,
            "created_at": r.created_at,
        }
        for r in records
    ]
