import asyncio
import random
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles as BaseStaticFiles
from starlette.responses import Response
from pydantic import BaseModel
import json

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional

from llm import MonaLLM
from personality_loader import load_personality_from_yaml
from tts import MonaTTS
from tts_sovits import MonaTTSSoVITS
from openai import OpenAI

# Initialize LLM and TTS (will be created on startup)
mona_llm: Optional[MonaLLM] = None
mona_tts: Optional[MonaTTS] = None
mona_tts_sovits: Optional[MonaTTSSoVITS] = None
openai_client: Optional[OpenAI] = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize LLM and TTS on startup"""
    global mona_llm, mona_tts, mona_tts_sovits, openai_client

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

    # Initialize GPT-SoVITS TTS (primary voice system)
    try:
        # Initialize with default settings (uses RunPod server or local if available)
        mona_tts_sovits = MonaTTSSoVITS()
        print(f"✓ Mona GPT-SoVITS initialized (using RunPod GPU server)")
    except Exception as e:
        print(f"⚠ Warning: Could not initialize GPT-SoVITS - {e}")
        print("⚠ Will fall back to OpenAI TTS.")
        mona_tts_sovits = None

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

    yield
    # Cleanup on shutdown (if needed)


app = FastAPI(title="Mona Brain API", lifespan=lifespan)

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://*.vercel.app",  # Allow all Vercel preview/production URLs
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",  # Regex pattern for Vercel domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


class Message(BaseModel):
    content: str
    sender: str  # "user" or "mona"
    timestamp: str


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


async def simulate_typing_delay():
    """Simulate Mona 'thinking' before responding"""
    await asyncio.sleep(random.uniform(0.5, 1.5))


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


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)

    try:
        # Send welcome message
        if mona_llm:
            # Get initial emotion state
            emotion_data = mona_llm.get_emotion_state(client_id)
            welcome_content = "Hi! I'm Mona! I'm so happy to meet you! 💖"
        else:
            emotion_data = {}
            welcome_content = "Hi! I'm Mona! I'm so happy to meet you! 💖 (Running in dummy mode)"

        welcome_message = {
            "type": "message",
            "content": welcome_content,
            "sender": "mona",
            "timestamp": datetime.now().isoformat(),
            "emotion": emotion_data,
        }
        await manager.send_message(welcome_message, client_id)

        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)

            print(f"Received from {client_id}: {message_data}")

            # Echo user message back (for confirmation)
            user_message = {
                "type": "message",
                "content": message_data["content"],
                "sender": "user",
                "timestamp": datetime.now().isoformat(),
            }
            await manager.send_message(user_message, client_id)

            # Send typing indicator
            typing_indicator = {
                "type": "typing",
                "isTyping": True,
            }
            await manager.send_message(typing_indicator, client_id)

            # Simulate thinking time
            await simulate_typing_delay()

            # Generate response using LLM or fallback to dummy
            if mona_llm:
                try:
                    async for event in mona_llm.stream_response(client_id, message_data["content"]):
                        if event["event"] == "chunk":
                            chunk_message = {
                                "type": "message_chunk",
                                "content": event.get("content", ""),
                                "sender": "mona",
                                "timestamp": datetime.now().isoformat(),
                            }
                            await manager.send_message(chunk_message, client_id)
                            if typing_indicator["isTyping"]:
                                typing_indicator["isTyping"] = False
                                await manager.send_message(typing_indicator, client_id)
                        elif event["event"] in {"complete", "error"}:
                            # Send text message immediately (without audio)
                            response_message = {
                                "type": "message",
                                "content": event.get("content", ""),
                                "sender": "mona",
                                "timestamp": datetime.now().isoformat(),
                                "emotion": event.get("emotion", {}),
                                "audioUrl": None,  # Will update later
                            }
                            # Stop typing indicator before final payload
                            if typing_indicator["isTyping"]:
                                typing_indicator["isTyping"] = False
                                await manager.send_message(typing_indicator, client_id)
                            await manager.send_message(response_message, client_id)

                            # Generate TTS audio in background (non-blocking)
                            if event.get("content"):
                                async def generate_audio_background():
                                    audio_url = None
                                    # Try GPT-SoVITS first (high-quality anime voice)
                                    if mona_tts_sovits:
                                        audio_path = await mona_tts_sovits.generate_speech(event["content"])
                                        if audio_path:
                                            audio_url = f"/audio/{Path(audio_path).name}"
                                            print(f"✓ Using GPT-SoVITS audio")

                                    # Fall back to OpenAI TTS if SoVITS failed or unavailable
                                    if not audio_url and mona_tts:
                                        audio_path = await mona_tts.generate_speech(event["content"])
                                        if audio_path:
                                            audio_url = f"/audio/{Path(audio_path).name}"
                                            print(f"✓ Using OpenAI TTS audio (fallback)")

                                    # Send audio update when ready
                                    if audio_url:
                                        audio_update = {
                                            "type": "audio_ready",
                                            "audioUrl": audio_url,
                                            "timestamp": datetime.now().isoformat(),
                                        }
                                        await manager.send_message(audio_update, client_id)

                                # Start audio generation without awaiting
                                asyncio.create_task(generate_audio_background())
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
                mona_response = get_dummy_response(message_data["content"])
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
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
