"""
CosyVoice TTS Server for Mona
Custom server that matches GPT-SoVITS API style for easy integration.

Usage:
    python server_mona_cosyvoice.py --port 9881

API:
    POST /tts
    {
        "text": "Hello there!",
        "text_lang": "en",
        "ref_audio_path": "/workspace/CosyVoice/assets/mona_voice/main_sample.wav",
        "prompt_text": "This is a sample voice...",
        "speed_factor": 1.0
    }

    Returns: Streaming WAV audio
"""

import argparse
import io
import os
import sys
import wave
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn

# Add CosyVoice to path
COSYVOICE_ROOT = Path(__file__).parent
sys.path.insert(0, str(COSYVOICE_ROOT))

# Import CosyVoice
try:
    from cosyvoice.cli.cosyvoice import CosyVoice
    from cosyvoice.utils.file_utils import load_wav
    print("✓ CosyVoice imported successfully")
except ImportError as e:
    print(f"✗ Failed to import CosyVoice: {e}")
    print("  Make sure you're running from the CosyVoice directory")
    sys.exit(1)


# Request model (matches GPT-SoVITS style)
class TTSRequest(BaseModel):
    text: str
    text_lang: str = "en"
    ref_audio_path: str = "/workspace/CosyVoice/assets/mona_voice/main_sample.wav"
    prompt_text: str = "This is a sample voice for you to get started with."
    prompt_lang: str = "en"
    speed_factor: float = 1.0
    streaming_mode: int = 1  # Ignored, always streams


# Initialize FastAPI
app = FastAPI(title="CosyVoice TTS Server for Mona")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance
cosyvoice_model = None
cached_prompt_audio = {}


def get_model():
    """Get or initialize the CosyVoice model."""
    global cosyvoice_model
    if cosyvoice_model is None:
        print("Loading CosyVoice model...")
        # Use CosyVoice2-0.5B for best quality/speed balance
        cosyvoice_model = CosyVoice("iic/CosyVoice2-0.5B", load_jit=False, load_trt=False)
        print("✓ CosyVoice model loaded")
    return cosyvoice_model


def get_prompt_audio(ref_audio_path: str):
    """Load and cache prompt audio."""
    if ref_audio_path not in cached_prompt_audio:
        if not os.path.exists(ref_audio_path):
            raise FileNotFoundError(f"Reference audio not found: {ref_audio_path}")
        print(f"Loading prompt audio: {ref_audio_path}")
        cached_prompt_audio[ref_audio_path] = load_wav(ref_audio_path, 16000)
        print(f"✓ Prompt audio loaded and cached")
    return cached_prompt_audio[ref_audio_path]


def numpy_to_wav_bytes(audio_np: np.ndarray, sample_rate: int = 22050) -> bytes:
    """Convert numpy audio array to WAV bytes."""
    # Ensure audio is in correct format
    if audio_np.dtype != np.int16:
        # Normalize and convert to int16
        audio_np = (audio_np * 32767).astype(np.int16)

    # Create WAV in memory
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_np.tobytes())

    buffer.seek(0)
    return buffer.read()


@app.post("/tts")
async def tts_endpoint(request: TTSRequest):
    """
    Generate speech from text using CosyVoice.
    Streams WAV audio as it's generated.
    """
    try:
        model = get_model()
        prompt_audio = get_prompt_audio(request.ref_audio_path)

        print(f"Generating speech: '{request.text[:50]}...' (lang={request.text_lang})")

        async def generate_audio():
            """Generator that yields audio chunks."""
            full_audio = []

            # Use zero-shot inference with the reference audio
            for chunk in model.inference_zero_shot(
                tts_text=request.text,
                prompt_text=request.prompt_text,
                prompt_speech_16k=prompt_audio,
                stream=True,
                speed=request.speed_factor
            ):
                # CosyVoice yields dict with 'tts_speech' key
                if isinstance(chunk, dict) and 'tts_speech' in chunk:
                    audio_chunk = chunk['tts_speech'].numpy()
                else:
                    audio_chunk = chunk.numpy() if hasattr(chunk, 'numpy') else chunk

                full_audio.append(audio_chunk)

            # Combine all chunks and convert to WAV
            if full_audio:
                combined = np.concatenate(full_audio)
                wav_bytes = numpy_to_wav_bytes(combined, sample_rate=22050)
                yield wav_bytes

        return StreamingResponse(
            generate_audio(),
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=speech.wav"}
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"TTS Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "model_loaded": cosyvoice_model is not None
    }


@app.on_event("startup")
async def startup_event():
    """Pre-load model on startup."""
    print("=" * 50)
    print("CosyVoice TTS Server for Mona")
    print("=" * 50)
    try:
        get_model()
        print("✓ Server ready!")
    except Exception as e:
        print(f"⚠ Model pre-load failed: {e}")
        print("  Model will load on first request")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CosyVoice TTS Server for Mona")
    parser.add_argument("--port", type=int, default=9881, help="Port to run on")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind to")
    args = parser.parse_args()

    print(f"Starting server on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port)
