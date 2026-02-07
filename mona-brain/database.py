"""
Database models and connection for Mona backend.
Uses SQLAlchemy with async SQLite support.
"""
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Text, Integer, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from config import DATABASE_URL


class Base(DeclarativeBase):
    pass


class User(Base):
    """Registered user account."""
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    google_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
    discord_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    nickname: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # What Mona calls the user
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Proactive messaging
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # Last user message
    proactive_enabled: Mapped[bool] = mapped_column(Integer, default=1)  # SQLite stores as int
    last_proactive_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # Last proactive msg from Mona

    # Notification preferences
    email_notifications: Mapped[bool] = mapped_column(Integer, default=1)  # Email when offline

    # Relationships
    messages: Mapped[List["ChatMessage"]] = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")


class ChatMessage(Base):
    """Persisted chat message."""
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text)
    audio_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    emotion: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="messages")


class GuestSession(Base):
    """Track guest user message counts."""
    __tablename__ = "guest_sessions"

    session_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_active: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserMemory(Base):
    """Persisted memories extracted from conversations.

    Stores facts, preferences, and important details about users
    that Mona should remember across sessions.

    v1.5 adds: key-based deduplication, confidence scoring, TTL for ephemeral data.
    """
    __tablename__ = "user_memories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)

    # Core content
    key: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)  # e.g., "name", "favorite_food", "likes:pizza"
    value: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # normalized value for deduplication
    content: Mapped[str] = mapped_column(Text)  # original phrasing

    # Classification
    category: Mapped[str] = mapped_column(String(50))  # fact, preference, event, feeling, other
    importance: Mapped[int] = mapped_column(Integer, default=50)
    confidence: Mapped[float] = mapped_column(Float, default=0.7)  # 0.0-1.0, regex=0.7, LLM=0.85, user-confirmed=1.0

    # Lifecycle
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, deprecated
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # TTL for ephemeral memories
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User")

    # Index for efficient deduplication queries
    __table_args__ = (
        Index("idx_user_key_status", "user_id", "key", "status"),
    )


class ProactiveMessage(Base):
    """Pending proactive messages for offline users."""
    __tablename__ = "proactive_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    content: Mapped[str] = mapped_column(Text)
    emotion: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    trigger_type: Mapped[str] = mapped_column(String(50))  # inactivity, milestone, affection, etc.
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, delivered, expired
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)  # Don't deliver stale messages

    user: Mapped["User"] = relationship("User")


class APIUsage(Base):
    """Track API costs per user for unit economics."""
    __tablename__ = "api_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    guest_session_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    service: Mapped[str] = mapped_column(String(50))  # openai_chat, openai_tts, whisper, fish, cartesia
    model: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    characters: Mapped[int] = mapped_column(Integer, default=0)  # for TTS
    estimated_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


# Async engine and session
engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database initialized successfully")


async def get_db() -> AsyncSession:
    """Get database session."""
    async with async_session() as session:
        yield session
