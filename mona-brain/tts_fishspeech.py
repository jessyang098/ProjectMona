"""
Fish Audio TTS Integration for Mona
Uses Fish Audio's official API for high-quality voice cloning.

Supports on-the-fly voice cloning with reference audio.
"""

import asyncio
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

import aiohttp

from lip_sync import get_lip_sync_generator
from tts_preprocess import clean_for_tts


class MonaTTSFishSpeech:
    """Handles text-to-speech generation using Fish Audio API."""

    def __init__(
        self,
        api_key: str = os.getenv("FISH_AUDIO_API_KEY", ""),
        ref_audio_path: str = "/workspace/GPT-SoVITS/assets/mona_voice/main_sample.wav",
        prompt_text: str = "This is a sample voice for you to get started with. It sounds kind of cute, but make sure there aren't long silences.",
        audio_dir: str = "assets/audio_cache",
        speed_factor: float = 1.0,
    ):
        self.api_key = api_key
        self.api_url = "https://api.fish.audio/v1/tts"
        self.ref_audio_path = ref_audio_path
        self.prompt_text = prompt_text
        self.speed_factor = speed_factor

        self.mock_mode = not api_key or api_key.lower() == "mock"
        if self.mock_mode:
            print("Fish Audio running in MOCK MODE (no API key)")

        self.audio_dir = Path(audio_dir)
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        self._warmed_up = False
        self._ref_audio_cache: Optional[bytes] = None

    def _load_reference_audio(self) -> Optional[bytes]:
        """Load and cache the reference audio file."""
        if self._ref_audio_cache is not None:
            return self._ref_audio_cache

        ref_path = Path(self.ref_audio_path)
        if not ref_path.exists():
            print(f"Reference audio not found: {self.ref_audio_path}")
            return None

        with open(ref_path, "rb") as f:
            self._ref_audio_cache = f.read()
        print(f"Loaded reference audio: {len(self._ref_audio_cache)} bytes")
        return self._ref_audio_cache

    async def warmup(self) -> bool:
        """Pre-warm by loading reference audio."""
        if self._warmed_up:
            return True

        if self.mock_mode:
            self._warmed_up = True
            return True

        print("Warming up Fish Audio TTS...")
        ref_audio = self._load_reference_audio()
        if ref_audio:
            self._warmed_up = True
            print("Fish Audio TTS ready!")
            return True
        return False

    def _get_cache_path(self, text: str, format: str = "mp3") -> Path:
        text_hash = hashlib.md5(
            f"{text}_{self.ref_audio_path}_{self.speed_factor}_fishspeech".encode()
        ).hexdigest()
        return self.audio_dir / f"{text_hash}.{format}"

    def _get_lip_sync_cache_path(self, text: str) -> Path:
        text_hash = hashlib.md5(
            f"{text}_{self.ref_audio_path}_{self.speed_factor}_fishspeech".encode()
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

        # Fish Audio returns MP3 by default, which is what we want
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

        # Load reference audio
        ref_audio = self._load_reference_audio()
        if not ref_audio:
            print("Fish Audio: No reference audio available")
            return None, None

        try:
            # Prepare multipart form data for Fish Audio API
            # Fish Audio uses msgpack but also supports multipart/form-data
            import struct

            # Build the request using aiohttp with multipart
            api_start = time.perf_counter()

            # Create form data
            form = aiohttp.FormData()
            form.add_field('text', text)
            form.add_field('format', 'mp3')
            form.add_field('mp3_bitrate', '128')

            # Add reference audio for voice cloning
            form.add_field(
                'reference_audio',
                ref_audio,
                filename='reference.wav',
                content_type='audio/wav'
            )
            form.add_field('reference_text', self.prompt_text)

            headers = {
                "Authorization": f"Bearer {self.api_key}",
            }

            timeout = aiohttp.ClientTimeout(total=60)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    self.api_url,
                    data=form,
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

            # Generate lip sync if needed
            lip_sync_data = None
            lip_sync_generator = get_lip_sync_generator()

            if generate_lip_sync and lip_sync_generator.is_available():
                lip_start = time.perf_counter()
                lip_sync_data = await lip_sync_generator.generate_lip_sync_async(
                    str(cache_path),
                    dialog_text=text
                )
                if lip_sync_data:
                    lip_sync_cache_path.write_text(json.dumps(lip_sync_data))
                lip_ms = (time.perf_counter() - lip_start) * 1000
                print(f"Fish Audio [Rhubarb] {lip_ms:.0f}ms")

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
