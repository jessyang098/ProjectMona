"""
Fish Audio TTS Integration for Mona
Uses Fish Audio's official API for high-quality TTS.
"""

import asyncio
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

import aiohttp

from lip_sync import generate_lip_sync_from_text
from tts_preprocess import clean_for_tts
from analytics import analytics, calculate_tts_cost


def get_mp3_duration(path: str) -> float:
    """Get actual MP3 duration using mutagen. Returns seconds."""
    try:
        from mutagen.mp3 import MP3
        audio = MP3(path)
        return audio.info.length
    except Exception as e:
        print(f"Fish Audio [Duration ERROR] {e}, falling back to estimate")
        return 0.0


class MonaTTSFishSpeech:
    """Handles text-to-speech generation using Fish Audio API."""

    def __init__(
        self,
        api_key: str = os.getenv("FISH_AUDIO_API_KEY", ""),
        model_id: str = os.getenv("FISH_MODEL_ID", "s1"),
        audio_dir: str = "assets/audio_cache",
    ):
        self.api_key = api_key
        self.model_id = model_id
        self.api_url = "https://api.fish.audio/v1/tts"

        self.mock_mode = not api_key or api_key.lower() == "mock"
        if self.mock_mode:
            print("Fish Audio running in MOCK MODE (no API key)")
        else:
            print(f"Fish Audio initialized with model: {model_id}")

        self.audio_dir = Path(audio_dir)
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        self._warmed_up = False

        # Connection pooling - reuse TCP connections for lower latency
        self._session: Optional[aiohttp.ClientSession] = None
        self._timeout = aiohttp.ClientTimeout(total=60)

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create a shared aiohttp session for connection pooling."""
        if self._session is None or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=10,  # Max concurrent connections
                keepalive_timeout=30,  # Keep connections alive
            )
            self._session = aiohttp.ClientSession(
                timeout=self._timeout,
                connector=connector,
            )
        return self._session

    async def close(self):
        """Close the shared session. Call on shutdown."""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None

    async def warmup(self) -> bool:
        """Mark as warmed up (no pre-warming needed for API)."""
        if self._warmed_up:
            return True

        if self.mock_mode:
            self._warmed_up = True
            return True

        self._warmed_up = True
        print("Fish Audio TTS ready!")
        return True

    def _get_cache_path(self, text: str, format: str = "mp3") -> Path:
        text_hash = hashlib.md5(
            f"{text}_{self.model_id}_fishspeech".encode()
        ).hexdigest()
        return self.audio_dir / f"{text_hash}.{format}"

    def _get_lip_sync_cache_path(self, text: str) -> Path:
        text_hash = hashlib.md5(
            f"{text}_{self.model_id}_fishspeech".encode()
        ).hexdigest()
        return self.audio_dir / f"{text_hash}.lipsync.json"

    async def generate_speech(
        self,
        text: str,
        use_cache: bool = True,
        convert_to_mp3: bool = False,
        generate_lip_sync: bool = True,
        preprocess: bool = True
    ) -> Tuple[Optional[str], Optional[List[Dict[str, Any]]]]:
        """Generate speech audio from text using Fish Audio API."""
        if not text or not text.strip():
            return None, None

        tts_start = time.perf_counter()

        if preprocess:
            text = clean_for_tts(text)

        if not text or not text.strip():
            return None, None

        # Fish Audio returns MP3 by default
        output_format = "mp3"
        cache_path = self._get_cache_path(text, format=output_format)
        lip_sync_cache_path = self._get_lip_sync_cache_path(text)

        # Return cached file if exists
        if use_cache and cache_path.exists():
            cache_ms = (time.perf_counter() - tts_start) * 1000
            lip_sync_data = None
            if lip_sync_cache_path.exists():
                try:
                    lip_sync_data = json.loads(lip_sync_cache_path.read_text())
                except Exception:
                    pass
            print(f"Fish Audio [CACHE HIT] {cache_ms:.0f}ms")
            return str(cache_path), lip_sync_data

        if self.mock_mode:
            return None, None

        try:
            api_start = time.perf_counter()

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "model": self.model_id,
            }

            payload = {"text": text}

            # Use pooled session for faster connection reuse
            session = await self._get_session()
            async with session.post(
                self.api_url,
                json=payload,
                headers=headers
            ) as response:
                api_ms = (time.perf_counter() - api_start) * 1000

                if response.status != 200:
                    error_text = await response.text()
                    print(f"Fish Audio [API ERROR] {api_ms:.0f}ms - {response.status}: {error_text}")
                    return None, None

                print(f"Fish Audio [API] {api_ms:.0f}ms ({api_ms/1000:.2f}s)")

                # Read the audio response
                audio_content = await response.read()
                print(f"Fish Audio [Audio Size] {len(audio_content)/1024:.1f}KB")

                # Save directly as MP3
                with open(cache_path, "wb") as f:
                    f.write(audio_content)

                # Track TTS cost
                cost = calculate_tts_cost(len(text), "fish")
                await analytics.track_api_cost(
                    service="fish",
                    model=self.model_id,
                    characters=len(text),
                    estimated_cost=cost,
                )

            # Generate text-based lip sync using actual MP3 duration
            lip_sync_data = None
            if generate_lip_sync:
                audio_duration = get_mp3_duration(str(cache_path))
                if audio_duration <= 0:
                    # Fallback: estimate from text length (~14 chars/sec)
                    char_count = len(" ".join(text.split()))
                    audio_duration = max(0.5, char_count / 14.0 + 0.3)
                lip_sync_data = generate_lip_sync_from_text(text, audio_duration)
                if lip_sync_data:
                    lip_sync_cache_path.write_text(json.dumps(lip_sync_data))

            total_ms = (time.perf_counter() - tts_start) * 1000
            print(f"Fish Audio [TOTAL] {total_ms:.0f}ms ({total_ms/1000:.2f}s)")
            return str(cache_path), lip_sync_data

        except aiohttp.ClientError as e:
            print(f"Fish Audio [CONNECTION ERROR] {e}")
            return None, None
        except Exception as e:
            print(f"Fish Audio [ERROR] {e}")
            import traceback
            traceback.print_exc()
            return None, None

    def clear_cache(self) -> int:
        count = 0
        for f in self.audio_dir.glob("*.mp3"):
            f.unlink()
            count += 1
        for f in self.audio_dir.glob("*.wav"):
            f.unlink()
            count += 1
        return count

    def get_cache_size(self) -> int:
        total = sum(f.stat().st_size for f in self.audio_dir.glob("*.mp3"))
        total += sum(f.stat().st_size for f in self.audio_dir.glob("*.wav"))
        return total
