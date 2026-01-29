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

from lip_sync import generate_lip_sync_from_text, get_wav_duration
from tts_preprocess import clean_for_tts


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

            timeout = aiohttp.ClientTimeout(total=60)
            async with aiohttp.ClientSession(timeout=timeout) as session:
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

            # Generate text-based lip sync
            lip_sync_data = None
            if generate_lip_sync:
                # Convert MP3 to WAV temporarily to get duration
                wav_path = cache_path.with_suffix('.wav')
                convert_proc = await asyncio.create_subprocess_exec(
                    'ffmpeg', '-y', '-i', str(cache_path), str(wav_path),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await asyncio.wait_for(convert_proc.communicate(), timeout=30)

                if convert_proc.returncode == 0:
                    audio_duration = get_wav_duration(str(wav_path))
                    if audio_duration > 0:
                        lip_sync_data = generate_lip_sync_from_text(text, audio_duration)
                        if lip_sync_data:
                            lip_sync_cache_path.write_text(json.dumps(lip_sync_data))

                    # Clean up WAV
                    if wav_path.exists():
                        wav_path.unlink()

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
