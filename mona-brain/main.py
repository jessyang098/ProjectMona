import asyncio
import random
import os
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional
from contextlib import asynccontextmanager

from logging_config import setup_logging
from analytics import analytics, Analytics

# Setup structured logging
setup_logging()


class RateLimiter:
    """Simple in-memory rate limiting."""

    def __init__(self, max_requests: int = 100, window_seconds: int = 3600):
        self.requests: Dict[str, list] = defaultdict(list)
        self.max_requests = max_requests
        self.window = window_seconds

    def is_allowed(self, user_id: str) -> bool:
        """Check if user is within rate limit."""
        now = time.time()
        # Clean old requests
        self.requests[user_id] = [t for t in self.requests[user_id] if now - t < self.window]
        if len(self.requests[user_id]) >= self.max_requests:
            return False
        self.requests[user_id].append(now)
        return True


# Global rate limiter (100 messages per hour)
rate_limiter = RateLimiter(max_requests=100, window_seconds=3600)


class PipelineTimer:
    """Tracks timing for the message-to-voice pipeline."""

    def __init__(self, client_id: str):
        self.client_id = client_id
        self.start_time = time.perf_counter()
        self.checkpoints: Dict[str, float] = {}

    def checkpoint(self, name: str):
        """Record a checkpoint time."""
        self.checkpoints[name] = time.perf_counter()

    def get_elapsed(self, checkpoint_name: str = None) -> float:
        """Get elapsed time in ms from start or from a checkpoint."""
        if checkpoint_name and checkpoint_name in self.checkpoints:
            return (time.perf_counter() - self.checkpoints[checkpoint_name]) * 1000
        return (time.perf_counter() - self.start_time) * 1000

    def log_summary(self):
        """Log a summary of all timing checkpoints."""
        total_ms = self.get_elapsed()
        print(f"\n{'='*60}")
        print(f"⏱️  PIPELINE TIMING SUMMARY (Client: {self.client_id[:8]}...)")
        print(f"{'='*60}")

        prev_time = self.start_time
        for name, checkpoint_time in self.checkpoints.items():
            step_ms = (checkpoint_time - prev_time) * 1000
            total_at_checkpoint = (checkpoint_time - self.start_time) * 1000
            print(f"  {name:<30} +{step_ms:>7.0f}ms  (total: {total_at_checkpoint:>7.0f}ms)")
            prev_time = checkpoint_time

        print(f"{'─'*60}")
        print(f"  {'TOTAL':<30} {total_ms:>8.0f}ms  ({total_ms/1000:.2f}s)")
        print(f"{'='*60}\n")
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles as BaseStaticFiles
from starlette.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import json

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional

from llm import MonaLLM
from database import init_db, get_db, User, ChatMessage, GuestSession, async_session
from auth import router as auth_router, verify_token
from config import GUEST_MESSAGE_LIMIT
from personality_loader import load_personality_from_yaml, list_available_personalities
from tts import MonaTTS
from tts_sovits import MonaTTSSoVITS
from tts_fishspeech import MonaTTSFishSpeech
from tts_cartesia import MonaTTSCartesia
from text_utils import preprocess_tts_text
from memory import save_memory_to_db, load_memories_from_db, deprecate_memories_by_key
from openai import OpenAI
from proactive import proactive_messenger

# Initialize LLM and TTS (will be created on startup)
mona_llm: Optional[MonaLLM] = None
mona_tts: Optional[MonaTTS] = None
mona_tts_sovits: Optional[MonaTTSSoVITS] = None
mona_tts_fishspeech: Optional[MonaTTSFishSpeech] = None
mona_tts_cartesia: Optional[MonaTTSCartesia] = None
openai_client: Optional[OpenAI] = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize LLM, TTS, and database on startup"""
    global mona_llm, mona_tts, mona_tts_sovits, mona_tts_fishspeech, mona_tts_cartesia, openai_client

    # Initialize database
    await init_db()

    # Download NLTK data if not present (needed for GPT-SoVITS English support)
    try:
        import nltk
        import ssl
        try:
            _create_unverified_https_context = ssl._create_unverified_context
        except AttributeError:
            pass
        else:
            ssl._create_default_https_context = _create_unverified_https_context

        nltk.download('cmudict', quiet=True)
        nltk.download('averaged_perceptron_tagger_eng', quiet=True)
        print("✓ NLTK data ready")
    except Exception as e:
        print(f"⚠ NLTK download warning: {e}")

    try:
        personality = load_personality_from_yaml()
        mona_llm = MonaLLM(personality=personality)
        print("✓ Mona LLM initialized with GPT")
    except ValueError as e:
        print(f"⚠ Warning: Could not initialize LLM - {e}")
        print("⚠ Running in DUMMY mode. Set OPENAI_API_KEY to enable GPT.")
        mona_llm = None

    # Initialize GPT-SoVITS TTS
    try:
        mona_tts_sovits = MonaTTSSoVITS()
        print(f"✓ Mona GPT-SoVITS initialized")
    except Exception as e:
        print(f"⚠ Warning: Could not initialize GPT-SoVITS - {e}")
        mona_tts_sovits = None

    # Initialize Fish Speech TTS
    try:
        mona_tts_fishspeech = MonaTTSFishSpeech()
        if not mona_tts_fishspeech.mock_mode:
            print(f"✓ Mona Fish Speech initialized")
        else:
            print(f"⚠ Fish Speech: No API key set (FISH_AUDIO_API_KEY)")
    except Exception as e:
        print(f"⚠ Warning: Could not initialize Fish Speech - {e}")
        mona_tts_fishspeech = None

    # Initialize Cartesia TTS
    try:
        mona_tts_cartesia = MonaTTSCartesia()
        if not mona_tts_cartesia.mock_mode:
            print(f"✓ Mona Cartesia TTS initialized")
        else:
            print(f"⚠ Cartesia: No API key set (CARTESIA_API_KEY)")
    except Exception as e:
        print(f"⚠ Warning: Could not initialize Cartesia - {e}")
        mona_tts_cartesia = None

    # Initialize OpenAI TTS (fallback)
    try:
        mona_tts = MonaTTS(voice="nova", model="tts-1")
        print("✓ Mona TTS initialized with OpenAI (fallback)")
    except ValueError as e:
        print(f"⚠ Warning: Could not initialize TTS - {e}")
        print("⚠ Voice output disabled. TTS requires OPENAI_API_KEY.")
        mona_tts = None

    # Initialize OpenAI client for Whisper (ASR)
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            openai_client = OpenAI(api_key=api_key)
            print("✓ OpenAI Whisper (ASR) initialized")
        else:
            openai_client = None
            print("⚠ ASR disabled. Set OPENAI_API_KEY to enable voice input.")
    except Exception as e:
        print(f"⚠ Warning: Could not initialize Whisper - {e}")
        openai_client = None

    # Initialize proactive messaging system
    if mona_llm:
        proactive_messenger.set_llm(mona_llm)
        proactive_messenger.set_connection_manager(manager)
        await proactive_messenger.start()
        print("✓ Proactive messaging system started")

    # Pre-warm models in background to speed up first user experience
    async def startup_warmup():
        """Warm up GPT-SoVITS and pre-cache the welcome greeting."""
        # 1. Warm up GPT-SoVITS model (loads into GPU)
        if mona_tts_sovits:
            await mona_tts_sovits.warmup()

            # 2. Pre-cache the welcome greeting so first user gets instant voice
            welcome_text = "Hi! I'm Mona! I'm so happy to meet you!"
            print(f"🎤 Pre-caching welcome greeting...")
            try:
                audio_path, _ = await mona_tts_sovits.generate_speech(welcome_text)
                if audio_path:
                    print(f"✓ Welcome greeting cached: {audio_path}")
                else:
                    print(f"⚠ Welcome greeting cache failed")
            except Exception as e:
                print(f"⚠ Welcome greeting cache error: {e}")

        # 3. Warm up OpenAI LLM connection (reduces first response latency)
        if mona_llm:
            print("🔥 Warming up OpenAI LLM connection...")
            try:
                # Send a minimal request to establish connection pool
                await mona_llm.client.chat.completions.create(
                    model=mona_llm.model,
                    messages=[{"role": "user", "content": "hi"}],
                    max_tokens=1
                )
                print("✓ OpenAI LLM connection warmed up")
            except Exception as e:
                print(f"⚠ LLM warmup error: {e}")

    import asyncio
    asyncio.create_task(startup_warmup())

    yield

    # Cleanup on shutdown
    await proactive_messenger.stop()
    print("✓ Proactive messaging stopped")

    if mona_tts_sovits:
        await mona_tts_sovits.close()
        print("✓ GPT-SoVITS session closed")
    if mona_tts_fishspeech:
        await mona_tts_fishspeech.close()
        print("✓ Fish Speech session closed")
    if mona_tts_cartesia:
        await mona_tts_cartesia.close()
        print("✓ Cartesia session closed")


app = FastAPI(title="Mona Brain API", lifespan=lifespan)

# Include auth router
app.include_router(auth_router)

# CORS configuration for Next.js frontend
# Need specific origins for OAuth (credentials require non-wildcard origins)
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://project-mona-v1.vercel.app",
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,  # Required for OAuth cookies
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # Expose all headers to client
)

# Create a custom StaticFiles class that adds CORS headers
class CORSStaticFiles(BaseStaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        if isinstance(response, Response):
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "*"
        return response

# Mount static files for audio playback with CORS headers
audio_cache_dir = Path("assets/audio_cache")
audio_cache_dir.mkdir(parents=True, exist_ok=True)
app.mount("/audio", CORSStaticFiles(directory=str(audio_cache_dir)), name="audio")


# Dummy Mona responses for Week 1
DUMMY_RESPONSES = [
    "Hi there! I'm Mona, your AI companion. How are you doing today?",
    "That's interesting! Tell me more about that.",
    "I'm still learning, but I'm here for you!",
    "Hehe, you're funny! 😊",
    "I appreciate you talking with me.",
    "What else would you like to chat about?",
    "I'm curious to know more about you!",
    "That sounds really cool!",
    "I'm here whenever you need someone to talk to.",
    "You seem like a really interesting person!",
]


class ConnectionManager:
    """Manages WebSocket connections"""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        print(f"Client {client_id} connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            print(f"Client {client_id} disconnected. Total connections: {len(self.active_connections)}")

    async def send_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(message)


manager = ConnectionManager()


import re

# Sentence boundary pattern for TTS splitting
SENTENCE_END_PATTERN = re.compile(r'([.!?])\s+')


def split_into_sentences(text: str) -> list[str]:
    """Split text into sentences for TTS pipelining."""
    if not text:
        return []
    # Split on sentence-ending punctuation followed by whitespace
    parts = SENTENCE_END_PATTERN.split(text)
    sentences = []
    i = 0
    while i < len(parts):
        if i + 1 < len(parts) and parts[i + 1] in '.!?':
            sentences.append(parts[i] + parts[i + 1])
            i += 2
        else:
            if parts[i].strip():
                sentences.append(parts[i])
            i += 1
    return sentences


def get_dummy_response(user_message: str) -> str:
    """Generate a dummy response from Mona"""
    # Simple keyword-based responses
    message_lower = user_message.lower()

    if any(greeting in message_lower for greeting in ["hello", "hi", "hey"]):
        return "Hello! It's so nice to see you! How's your day going?"
    elif any(word in message_lower for word in ["how are you", "how're you"]):
        return "I'm doing great, thanks for asking! I'm excited to chat with you!"
    elif any(word in message_lower for word in ["bye", "goodbye", "see you"]):
        return "Goodbye! I'll miss you! Come back soon, okay? 💕"
    elif "?" in user_message:
        return random.choice([
            "That's a great question! Let me think about it...",
            "Hmm, I'm not entirely sure, but I'd love to explore that with you!",
            "Interesting question! What do you think?",
        ])
    else:
        return random.choice(DUMMY_RESPONSES)


@app.get("/")
async def root():
    llm_status = "GPT-enabled" if mona_llm else "Dummy mode"
    return {"message": "Mona Brain API is running", "status": "online", "llm": llm_status}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "connections": len(manager.active_connections),
        "llm_enabled": mona_llm is not None
    }


@app.get("/personalities")
async def get_personalities():
    """List available personality archetypes"""
    return {
        "personalities": list_available_personalities(),
        "current": "girlfriend",  # Default, would be per-user in production
    }


class PersonalitySwitchRequest(BaseModel):
    personality_id: str


@app.post("/personalities/switch")
async def switch_personality(request: PersonalitySwitchRequest):
    """Switch to a different personality archetype.

    Note: In production, this would persist to user preferences.
    Currently it reloads the global LLM personality (affects all users).
    """
    global mona_llm

    available = [p["id"] for p in list_available_personalities()]
    if request.personality_id not in available:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=400,
            content={"error": f"Invalid personality. Available: {available}"}
        )

    try:
        new_personality = load_personality_from_yaml(archetype=request.personality_id)
        if mona_llm:
            mona_llm.personality = new_personality
            # Clear all conversation states to apply new personality
            mona_llm.conversations.clear()
            print(f"✓ Switched personality to: {request.personality_id}")

        return {
            "success": True,
            "personality": request.personality_id,
            "message": f"Switched to {request.personality_id} personality",
        }
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, token: Optional[str] = None):
    await manager.connect(websocket, client_id)

    # Check authentication
    user: Optional[User] = None
    is_guest = True
    guest_session_id = client_id  # Use client_id as guest session ID

    if token:
        payload = verify_token(token)
        if payload:
            user_id = payload.get("sub")
            async with async_session() as db:
                result = await db.execute(select(User).where(User.id == user_id))
                user = result.scalar_one_or_none()
                if user:
                    is_guest = False
                    print(f"🔐 Authenticated user: {user.email}")

    # Track guest session
    if is_guest:
        async with async_session() as db:
            result = await db.execute(select(GuestSession).where(GuestSession.session_id == guest_session_id))
            guest_session = result.scalar_one_or_none()
            if not guest_session:
                guest_session = GuestSession(session_id=guest_session_id, message_count=0)
                db.add(guest_session)
                await db.commit()
            print(f"👤 Guest session: {guest_session_id}, messages: {guest_session.message_count if guest_session else 0}")

    # Use user.id for LLM state so it persists across devices/sessions
    llm_user_id = user.id if user else client_id

    try:
        # Send auth status to client
        async with async_session() as db:
            guest_messages_remaining = GUEST_MESSAGE_LIMIT
            if is_guest:
                result = await db.execute(select(GuestSession).where(GuestSession.session_id == guest_session_id))
                guest_session = result.scalar_one_or_none()
                if guest_session:
                    guest_messages_remaining = max(0, GUEST_MESSAGE_LIMIT - guest_session.message_count)

            auth_status = {
                "type": "auth_status",
                "isAuthenticated": not is_guest,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "avatarUrl": user.avatar_url,
                } if user else None,
                "guestMessagesRemaining": guest_messages_remaining if is_guest else None,
                "guestMessageLimit": GUEST_MESSAGE_LIMIT if is_guest else None,
            }
            await manager.send_message(auth_status, client_id)

            # Set user info for personalized LLM responses
            if user and mona_llm:
                mona_llm.set_user_info(llm_user_id, name=user.name, nickname=user.nickname)
                print(f"👤 Set user info for LLM: {user.nickname or user.name} (id: {llm_user_id[:8]}...)")

            # Load chat history for authenticated users
            if user:
                result = await db.execute(
                    select(ChatMessage)
                    .where(ChatMessage.user_id == user.id)
                    .order_by(ChatMessage.created_at.asc())
                    .limit(25)  # Load last 25 messages for UI
                )
                history = result.scalars().all()
                if history:
                    history_message = {
                        "type": "chat_history",
                        "messages": [
                            {
                                "content": msg.content,
                                "sender": "mona" if msg.role == "assistant" else "user",
                                "timestamp": msg.created_at.isoformat(),
                                "emotion": {"emotion": msg.emotion} if msg.emotion else None,
                            }
                            for msg in history
                        ],
                    }
                    await manager.send_message(history_message, client_id)
                    print(f"📜 Sent {len(history)} messages from history to {user.email}")

                    # Load past conversation into LLM so it remembers context
                    if mona_llm:
                        llm_history = [{"role": msg.role, "content": msg.content} for msg in history]
                        mona_llm.load_conversation_history(llm_user_id, llm_history)

                # Load persisted memories from database
                if mona_llm:
                    db_memories = await load_memories_from_db(db, user.id)
                    if db_memories:
                        mona_llm.load_memories(llm_user_id, db_memories)
                        print(f"🧠 Loaded {len(db_memories)} memories for {user.email}")

                # Deliver any pending proactive messages
                try:
                    delivered = await proactive_messenger.deliver_pending_messages(db, user.id)
                    if delivered:
                        print(f"📬 Delivered pending proactive message to {user.email}")
                except Exception as e:
                    print(f"⚠ Failed to deliver pending messages: {e}")

        # Send welcome message
        if mona_llm:
            # Get initial emotion state
            emotion_data = mona_llm.get_emotion_state(llm_user_id)
            welcome_content = "Hi! I'm Mona! I'm so happy to meet you!"
        else:
            emotion_data = {}
            welcome_content = "Hi! I'm Mona! I'm so happy to meet you! (Running in dummy mode)"

        welcome_message = {
            "type": "message",
            "content": welcome_content,
            "sender": "mona",
            "timestamp": datetime.now().isoformat(),
            "emotion": emotion_data,
        }
        await manager.send_message(welcome_message, client_id)

        # Generate welcome voice in background (non-blocking)
        async def generate_welcome_audio():
            print(f"🎤 [STARTUP AUDIO] Starting audio generation for client {client_id}")
            print(f"🎤 [STARTUP AUDIO] Text to generate: '{welcome_content}'")
            audio_url = None
            lip_sync_data = None

            # Preprocess text to remove problematic phonemes like "tch"
            tts_text = preprocess_tts_text(welcome_content)

            # Try GPT-SoVITS first (high-quality anime voice)
            if mona_tts_sovits:
                print(f"🎤 [STARTUP AUDIO] Attempting GPT-SoVITS generation...")
                try:
                    audio_path, lip_sync_data = await mona_tts_sovits.generate_speech(tts_text)
                    print(f"🎤 [STARTUP AUDIO] GPT-SoVITS returned: {audio_path}")
                    if audio_path:
                        audio_url = f"/audio/{Path(audio_path).name}"
                        print(f"✓ [STARTUP AUDIO] Generated startup greeting voice with GPT-SoVITS: {audio_url}")
                        if lip_sync_data:
                            print(f"✓ [STARTUP AUDIO] Lip sync data: {len(lip_sync_data)} cues")
                    else:
                        print(f"⚠️ [STARTUP AUDIO] GPT-SoVITS returned None")
                except Exception as e:
                    print(f"❌ [STARTUP AUDIO] GPT-SoVITS error: {e}")
            else:
                print(f"⚠️ [STARTUP AUDIO] GPT-SoVITS not available (mona_tts_sovits is None)")

            # Fall back to OpenAI TTS if SoVITS failed
            if not audio_url and mona_tts:
                print(f"🎤 [STARTUP AUDIO] Attempting OpenAI TTS fallback...")
                try:
                    audio_path, openai_lip_sync = await mona_tts.generate_speech(tts_text)
                    print(f"🎤 [STARTUP AUDIO] OpenAI TTS returned: {audio_path}")
                    if audio_path:
                        audio_url = f"/audio/{Path(audio_path).name}"
                        # Use OpenAI TTS lip sync if GPT-SoVITS didn't provide any
                        if not lip_sync_data and openai_lip_sync:
                            lip_sync_data = openai_lip_sync
                            print(f"✓ [STARTUP AUDIO] Lip sync from OpenAI TTS: {len(lip_sync_data)} cues")
                        print(f"✓ [STARTUP AUDIO] Generated startup greeting voice with OpenAI TTS: {audio_url}")
                    else:
                        print(f"⚠️ [STARTUP AUDIO] OpenAI TTS returned None")
                except Exception as e:
                    print(f"❌ [STARTUP AUDIO] OpenAI TTS error: {e}")
            elif not audio_url:
                print(f"⚠️ [STARTUP AUDIO] OpenAI TTS not available (mona_tts is None)")

            # Send audio update when ready
            if audio_url:
                audio_update = {
                    "type": "audio_ready",
                    "audioUrl": audio_url,
                    "lipSync": lip_sync_data,  # Include lip sync timing data
                    "timestamp": datetime.now().isoformat(),
                }
                print(f"📤 [STARTUP AUDIO] Sending audio_ready message: {audio_update}")
                await manager.send_message(audio_update, client_id)
                print(f"✓ [STARTUP AUDIO] Audio update sent successfully")
            else:
                print(f"❌ [STARTUP AUDIO] No audio URL generated - no audio will be sent")

        # Start background task
        print(f"🚀 [STARTUP AUDIO] Creating background task for audio generation")
        asyncio.create_task(generate_welcome_audio())

        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)

            # Start pipeline timer
            timer = PipelineTimer(client_id)
            timer.checkpoint("1_message_received")

            # Extract image data and TTS engine preference
            image_base64 = message_data.get("image")
            has_image = bool(image_base64)
            user_content = message_data.get("content", "") or ""
            tts_engine = message_data.get("tts_engine", "sovits")  # "sovits" or "fishspeech"
            lip_sync_mode = message_data.get("lip_sync_mode", "textbased")  # "textbased" or "realtime"
            use_lip_sync = lip_sync_mode == "textbased"
            print(f"Lip sync mode: {lip_sync_mode} (enabled={use_lip_sync})")

            # Rate limiting check
            rate_limit_id = user.id if user else guest_session_id
            if not rate_limiter.is_allowed(rate_limit_id):
                rate_limit_message = {
                    "type": "error",
                    "message": "You're sending messages too quickly. Please slow down.",
                }
                await manager.send_message(rate_limit_message, client_id)
                continue

            # Check guest message limit
            if is_guest:
                async with async_session() as db:
                    result = await db.execute(select(GuestSession).where(GuestSession.session_id == guest_session_id))
                    guest_session = result.scalar_one_or_none()
                    if guest_session and guest_session.message_count >= GUEST_MESSAGE_LIMIT:
                        limit_message = {
                            "type": "guest_limit_reached",
                            "message": "You've reached the free message limit. Please sign in to continue chatting!",
                            "messagesUsed": guest_session.message_count,
                            "messageLimit": GUEST_MESSAGE_LIMIT,
                        }
                        await manager.send_message(limit_message, client_id)
                        continue  # Skip processing this message

                    # Increment guest message count
                    if guest_session:
                        guest_session.message_count += 1
                        guest_session.last_active = datetime.now()
                        await db.commit()

            # Track message_sent event
            analytics.track(
                Analytics.EVENT_MESSAGE_SENT,
                user.id if user else None,
                {"has_image": has_image, "guest_session_id": guest_session_id if is_guest else None}
            )

            # Update user's last_message_at for proactive messaging
            if user:
                async with async_session() as db:
                    result = await db.execute(select(User).where(User.id == user.id))
                    db_user = result.scalar_one_or_none()
                    if db_user:
                        db_user.last_message_at = datetime.utcnow()
                        await db.commit()

            timer.checkpoint("2_validation_complete")

            # Echo user message back (for confirmation)
            user_message = {
                "type": "message",
                "content": user_content,
                "sender": "user",
                "timestamp": datetime.now().isoformat(),
                "hasImage": has_image,
            }
            await manager.send_message(user_message, client_id)

            # Save user message to database (for authenticated users)
            if user:
                async with async_session() as db:
                    chat_msg = ChatMessage(
                        user_id=user.id,
                        role="user",
                        content=user_content,
                    )
                    db.add(chat_msg)
                    await db.commit()

            # Send typing indicator
            typing_indicator = {
                "type": "typing",
                "isTyping": True,
            }
            await manager.send_message(typing_indicator, client_id)

            timer.checkpoint("3_ready_for_llm")

            # Generate response using LLM or fallback to dummy
            if mona_llm:
                try:
                    full_response = ""

                    async for event in mona_llm.stream_response(llm_user_id, user_content, image_base64):
                        if event["event"] == "chunk":
                            chunk_content = event.get("content", "")
                            full_response += chunk_content

                            # Send chunk to frontend for display
                            chunk_message = {
                                "type": "message_chunk",
                                "content": chunk_content,
                                "sender": "mona",
                                "timestamp": datetime.now().isoformat(),
                            }
                            await manager.send_message(chunk_message, client_id)
                            if typing_indicator["isTyping"]:
                                typing_indicator["isTyping"] = False
                                await manager.send_message(typing_indicator, client_id)

                        elif event["event"] in {"complete", "error"}:
                            timer.checkpoint("4_llm_complete")

                            mona_content = event.get("content", "")
                            emotion_info = event.get("emotion", {})

                            # Generate TTS for full response
                            audio_url = None
                            lip_sync_data = None
                            used_engine = None
                            tts_text = preprocess_tts_text(mona_content)

                            if tts_text.strip():
                                # Use selected TTS engine
                                if tts_engine == "fishspeech" and mona_tts_fishspeech and not mona_tts_fishspeech.mock_mode:
                                    audio_path, lip_sync_data = await mona_tts_fishspeech.generate_speech(tts_text, generate_lip_sync=use_lip_sync)
                                    used_engine = "fishspeech"
                                    if audio_path:
                                        audio_url = f"/audio/{Path(audio_path).name}"

                                elif tts_engine == "cartesia" and mona_tts_cartesia and not mona_tts_cartesia.mock_mode:
                                    audio_path, lip_sync_data = await mona_tts_cartesia.generate_speech(tts_text, generate_lip_sync=use_lip_sync)
                                    used_engine = "cartesia"
                                    if audio_path:
                                        audio_url = f"/audio/{Path(audio_path).name}"

                                elif tts_engine == "sovits" and mona_tts_sovits:
                                    audio_path, lip_sync_data = await mona_tts_sovits.generate_speech(tts_text, generate_lip_sync=use_lip_sync)
                                    used_engine = "sovits"
                                    if audio_path:
                                        audio_url = f"/audio/{Path(audio_path).name}"

                                # Fall back to sovits if selected engine failed
                                if not audio_url and mona_tts_sovits:
                                    audio_path, lip_sync_data = await mona_tts_sovits.generate_speech(tts_text, generate_lip_sync=use_lip_sync)
                                    used_engine = "sovits"
                                    if audio_path:
                                        audio_url = f"/audio/{Path(audio_path).name}"

                                # Fall back to OpenAI TTS as last resort
                                if not audio_url and mona_tts:
                                    audio_path, openai_lip_sync = await mona_tts.generate_speech(tts_text, generate_lip_sync=use_lip_sync)
                                    used_engine = "openai"
                                    if audio_path:
                                        audio_url = f"/audio/{Path(audio_path).name}"
                                        if not lip_sync_data and openai_lip_sync:
                                            lip_sync_data = openai_lip_sync

                            timer.checkpoint("5_tts_complete")

                            # Track voice_used if audio was generated
                            if audio_url and used_engine:
                                analytics.track(
                                    Analytics.EVENT_VOICE_USED,
                                    user.id if user else None,
                                    {"engine": used_engine, "guest_session_id": guest_session_id if is_guest else None}
                                )

                            # Send complete message
                            response_message = {
                                "type": "message",
                                "content": mona_content,
                                "sender": "mona",
                                "timestamp": datetime.now().isoformat(),
                                "emotion": emotion_info,
                                "audioUrl": audio_url,
                                "lipSync": lip_sync_data,
                            }
                            if typing_indicator["isTyping"]:
                                typing_indicator["isTyping"] = False
                                await manager.send_message(typing_indicator, client_id)
                            await manager.send_message(response_message, client_id)

                            if audio_url:
                                lip_sync_cue_count = len(lip_sync_data) if lip_sync_data else 0
                                print(f"🎤 TTS complete | engine={used_engine} | cues={lip_sync_cue_count} | text='{tts_text[:50]}...'")

                            # Save Mona's response to database (for authenticated users)
                            if user and mona_content:
                                async with async_session() as db:
                                    chat_msg = ChatMessage(
                                        user_id=user.id,
                                        role="assistant",
                                        content=mona_content,
                                        emotion=emotion_info.get("emotion") if emotion_info else None,
                                    )
                                    db.add(chat_msg)
                                    await db.commit()

                                    # Save any new memories extracted from user message
                                    if mona_llm:
                                        pending_deprecations = mona_llm.get_pending_deprecations(llm_user_id)
                                        if pending_deprecations:
                                            await deprecate_memories_by_key(db, user.id, pending_deprecations)
                                            print(f"🧠 Deprecated {len(pending_deprecations)} old memories for {user.email}")

                                        pending_memories = mona_llm.get_pending_memories(llm_user_id)
                                        for mem in pending_memories:
                                            await save_memory_to_db(db, user.id, mem)
                                        if pending_memories:
                                            print(f"🧠 Saved {len(pending_memories)} new memories for {user.email}")

                            # Log timing summary
                            timer.log_summary()
                except Exception as e:
                    print(f"LLM Error: {e}")
                    fallback_message = {
                        "type": "message",
                        "content": "Sorry, I'm having trouble thinking right now... 😅",
                        "sender": "mona",
                        "timestamp": datetime.now().isoformat(),
                        "emotion": {},
                    }
                    typing_indicator["isTyping"] = False
                    await manager.send_message(typing_indicator, client_id)
                    await manager.send_message(fallback_message, client_id)
            else:
                mona_response = get_dummy_response(user_content)
                emotion_data = {}

                response_message = {
                    "type": "message",
                    "content": mona_response,
                    "sender": "mona",
                    "timestamp": datetime.now().isoformat(),
                    "emotion": emotion_data,
                }

                # Stop typing indicator
                typing_indicator["isTyping"] = False
                await manager.send_message(typing_indicator, client_id)

                # Send actual response
                await manager.send_message(response_message, client_id)

    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        print(f"Error in WebSocket connection: {e}")
        manager.disconnect(client_id)


@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe audio using OpenAI Whisper API"""
    from fastapi.responses import JSONResponse

    if not openai_client:
        return JSONResponse(
            status_code=503,
            content={"error": "ASR not available. Set OPENAI_API_KEY to enable voice input."}
        )

    try:
        # Read the audio file
        audio_data = await audio.read()

        # Create a temporary file-like object
        from io import BytesIO
        audio_file = BytesIO(audio_data)
        audio_file.name = "recording.webm"

        # Transcribe using OpenAI Whisper
        transcript = openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="text"
        )

        print(f"✓ Transcribed: {transcript}")

        return {"text": transcript}

    except Exception as e:
        print(f"✗ Transcription error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))
    parser.add_argument("--host", type=str, default="0.0.0.0")
    args = parser.parse_args()

    uvicorn.run(app, host=args.host, port=args.port)
