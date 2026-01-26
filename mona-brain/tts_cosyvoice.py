"""
CosyVoice TTS Integration for Mona
Uses CosyVoice server for high-quality streaming anime voice synthesis.

Drop-in alternative to tts_sovits.py with the same API.
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


class MonaTTSCosyVoice:
    """Handles text-to-speech generation using CosyVoice."""

    def __init__(
        self,
        cosyvoice_url: str = os.getenv("COSYVOICE_URL", "http://localhost:9881/tts"),
        ref_audio_path: str = "/workspace/CosyVoice/assets/mona_voice/main_sample.wav",
        prompt_text: str = "This is a sample voice for you to get started with. It sounds kind of cute, but make sure there aren't long silences.",
        text_lang: str = "en",
        prompt_lang: str = "en",
        audio_dir: str = "assets/audio_cache",
        speed_factor: float = 1.0,
    ):
        self.cosyvoice_url = cosyvoice_url
        self.ref_audio_path = ref_audio_path
        self.prompt_text = prompt_text
        self.text_lang = text_lang
        self.prompt_lang = prompt_lang
        self.speed_factor = speed_factor

        self.mock_mode = cosyvoice_url.lower() == "mock"
        if self.mock_mode:
            print("CosyVoice running in MOCK MODE")

        self.audio_dir = Path(audio_dir)
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        self._warmed_up = False

    async def warmup(self) -> bool:
        """Pre-warm the CosyVoice model."""
        if self._warmed_up:
            return True

        if self.mock_mode:
            self._warmed_up = True
            return True

        print("🔥 Warming up CosyVoice model...")
        try:
            payload = {
                "text": "Hi!",
                "text_lang": self.text_lang,
                "ref_audio_path": self.ref_audio_path,
                "prompt_text": self.prompt_text,
                "speed_factor": self.speed_factor,
            }

            timeout = aiohttp.ClientTimeout(total=120)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(self.cosyvoice_url, json=payload) as response:
                    if response.status == 200:
                        await response.read()
                        self._warmed_up = True
                        print("✓ CosyVoice model warmed up!")
                        return True
                    else:
                        print(f"✗ CosyVoice warmup failed: {response.status}")
                        return False

        except Exception as e:
            print(f"✗ CosyVoice warmup error: {e}")
            return False

    def _get_cache_path(self, text: str, format: str = "wav") -> Path:
        text_hash = hashlib.md5(
            f"{text}_{self.ref_audio_path}_{self.speed_factor}_cosyvoice".encode()
        ).hexdigest()
        return self.audio_dir / f"{text_hash}.{format}"

    def _get_lip_sync_cache_path(self, text: str) -> Path:
        text_hash = hashlib.md5(
            f"{text}_{self.ref_audio_path}_{self.speed_factor}_cosyvoice".encode()
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
        """Generate speech audio from text using CosyVoice."""
        if not text or not text.strip():
            return None, None

        tts_start = time.perf_counter()

        if preprocess:
            text = clean_for_tts(text)

        if not text or not text.strip():
            return None, None

        output_format = "mp3" if convert_to_mp3 else "wav"
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
            print(f"⏱️  CosyVoice [CACHE HIT] {cache_ms:.0f}ms")
            return str(cache_path), lip_sync_data

        if self.mock_mode:
            return None, None

        try:
            payload = {
                "text": text,
                "text_lang": self.text_lang,
                "ref_audio_path": self.ref_audio_path,
                "prompt_text": self.prompt_text,
                "prompt_lang": self.prompt_lang,
                "speed_factor": self.speed_factor,
            }

            api_start = time.perf_counter()
            timeout = aiohttp.ClientTimeout(total=60)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(self.cosyvoice_url, json=payload) as response:
                    api_ms = (time.perf_counter() - api_start) * 1000

                    if response.status != 200:
                        error_text = await response.text()
                        print(f"⏱️  CosyVoice [API ERROR] {api_ms:.0f}ms - {response.status}: {error_text}")
                        return None, None

                    print(f"⏱️  CosyVoice [API] {api_ms:.0f}ms ({api_ms/1000:.2f}s)")

                    wav_path = self.audio_dir / f"{cache_path.stem}_temp.wav" if convert_to_mp3 else cache_path
                    audio_content = await response.read()
                    with open(wav_path, "wb") as f:
                        f.write(audio_content)

            # Generate lip sync and convert to MP3
            lip_sync_data = None
            lip_sync_generator = get_lip_sync_generator()

            if convert_to_mp3 and generate_lip_sync and lip_sync_generator.is_available():
                # PARALLEL: Rhubarb + FFmpeg
                parallel_start = time.perf_counter()

                async def run_lip_sync():
                    return await lip_sync_generator.generate_lip_sync_async(str(wav_path), dialog_text=text)

                async def run_ffmpeg():
                    proc = await asyncio.create_subprocess_exec(
                        "ffmpeg", "-i", str(wav_path),
                        "-codec:a", "libmp3lame", "-b:a", "128k",
                        "-ar", "44100", "-ac", "1", "-y", str(cache_path),
                        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
                    )
                    await asyncio.wait_for(proc.communicate(), timeout=30)
                    return proc.returncode

                try:
                    lip_sync_data, ffmpeg_rc = await asyncio.gather(run_lip_sync(), run_ffmpeg())
                    parallel_ms = (time.perf_counter() - parallel_start) * 1000

                    if ffmpeg_rc == 0:
                        wav_path.unlink()
                        print(f"⏱️  CosyVoice [Rhubarb+FFmpeg] {parallel_ms:.0f}ms")
                    else:
                        return None, None

                    if lip_sync_data:
                        lip_sync_cache_path.write_text(json.dumps(lip_sync_data))

                except Exception:
                    if wav_path.exists():
                        wav_path.unlink()
                    return None, None
            else:
                # SEQUENTIAL
                if generate_lip_sync and lip_sync_generator.is_available():
                    lip_start = time.perf_counter()
                    lip_sync_data = await lip_sync_generator.generate_lip_sync_async(str(wav_path), dialog_text=text)
                    if lip_sync_data:
                        lip_sync_cache_path.write_text(json.dumps(lip_sync_data))
                    print(f"⏱️  CosyVoice [Rhubarb] {(time.perf_counter() - lip_start) * 1000:.0f}ms")

                if convert_to_mp3:
                    mp3_start = time.perf_counter()
                    try:
                        proc = await asyncio.create_subprocess_exec(
                            "ffmpeg", "-i", str(wav_path),
                            "-codec:a", "libmp3lame", "-b:a", "128k",
                            "-ar", "44100", "-ac", "1", "-y", str(cache_path),
                            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
                        )
                        await asyncio.wait_for(proc.communicate(), timeout=30)
                        if proc.returncode == 0:
                            wav_path.unlink()
                            print(f"⏱️  CosyVoice [FFmpeg] {(time.perf_counter() - mp3_start) * 1000:.0f}ms")
                        else:
                            return None, None
                    except Exception:
                        if wav_path.exists():
                            wav_path.unlink()
                        return None, None

            total_ms = (time.perf_counter() - tts_start) * 1000
            print(f"⏱️  CosyVoice [TOTAL] {total_ms:.0f}ms ({total_ms/1000:.2f}s)")
            return str(cache_path), lip_sync_data

        except aiohttp.ClientError as e:
            print(f"⏱️  CosyVoice [CONNECTION ERROR] {e}")
            return None, None
        except Exception as e:
            print(f"⏱️  CosyVoice [ERROR] {e}")
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
