"""
GPT-SoVITS TTS Integration for Mona
Uses local GPT-SoVITS server for high-quality anime voice synthesis
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


class MonaTTSSoVITS:
    """Handles text-to-speech generation using GPT-SoVITS."""

    def __init__(
        self,
        sovits_url: str = os.getenv("SOVITS_URL", "https://rnc9ewc4dipmg3-9880.proxy.runpod.net/tts"),
        ref_audio_path: str = "/workspace/GPT-SoVITS/assets/mona_voice/main_sample.wav",
        prompt_text: str = "This is a sample voice for you to get started with. It sounds kind of cute, but make sure there aren't long silences.",
        text_lang: str = "en",
        prompt_lang: str = "en",
        audio_dir: str = "assets/audio_cache",
        speed_factor: float = 1.3,
    ):
        """
        Initialize SoVITS TTS.

        Args:
            sovits_url: URL of the GPT-SoVITS API endpoint (set to "mock" for testing without TTS)
            ref_audio_path: Path to reference audio for voice cloning
            prompt_text: Transcription of the reference audio
            text_lang: Language of input text
            prompt_lang: Language of prompt
            audio_dir: Directory to cache generated audio files
            speed_factor: Speech speed multiplier
        """
        self.sovits_url = sovits_url
        self.ref_audio_path = ref_audio_path
        self.prompt_text = prompt_text
        self.text_lang = text_lang
        self.prompt_lang = prompt_lang
        self.speed_factor = speed_factor

        # Check if running in mock mode (for local testing without TTS)
        self.mock_mode = sovits_url.lower() == "mock"
        if self.mock_mode:
            print("🎭 GPT-SoVITS running in MOCK MODE (no actual audio generation)")

        # Setup audio cache directory
        self.audio_dir = Path(audio_dir)
        self.audio_dir.mkdir(parents=True, exist_ok=True)

        # Track if warmup has been done
        self._warmed_up = False

    async def warmup(self) -> bool:
        """
        Pre-warm the GPT-SoVITS model by generating a short test phrase.
        This loads models into GPU memory so first real request is faster.

        Returns:
            True if warmup succeeded, False otherwise
        """
        if self._warmed_up:
            print("🔥 GPT-SoVITS already warmed up")
            return True

        # Skip warmup in mock mode
        if self.mock_mode:
            self._warmed_up = True
            print("🎭 Mock mode: Skipping GPT-SoVITS warmup")
            return True

        print("🔥 Warming up GPT-SoVITS model...")
        warmup_text = "Hi!"  # Very short text for quick warmup

        try:
            payload = {
                "text": warmup_text,
                "text_lang": self.text_lang,
                "ref_audio_path": self.ref_audio_path,
                "prompt_text": self.prompt_text,
                "prompt_lang": self.prompt_lang,
                "speed_factor": self.speed_factor,
                "text_split_method": "cut0",
                "streaming_mode": 1,
            }

            timeout = aiohttp.ClientTimeout(total=60)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(self.sovits_url, json=payload) as response:
                    if response.status == 200:
                        # Consume the response to trigger model loading
                        await response.read()
                        self._warmed_up = True
                        print("✓ GPT-SoVITS model warmed up successfully!")
                        return True
                    else:
                        print(f"✗ GPT-SoVITS warmup failed: {response.status}")
                        return False

        except asyncio.TimeoutError:
            print("✗ GPT-SoVITS warmup timed out (model may still be loading)")
            return False
        except Exception as e:
            print(f"✗ GPT-SoVITS warmup error: {e}")
            return False

    def _get_cache_path(self, text: str, format: str = "wav") -> Path:
        """Generate cache file path based on text hash and format."""
        text_hash = hashlib.md5(
            f"{text}_{self.ref_audio_path}_{self.speed_factor}".encode()
        ).hexdigest()
        return self.audio_dir / f"{text_hash}.{format}"

    def _get_lip_sync_cache_path(self, text: str) -> Path:
        """Generate cache file path for lip sync data."""
        text_hash = hashlib.md5(
            f"{text}_{self.ref_audio_path}_{self.speed_factor}".encode()
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
        """
        Generate speech audio from text using GPT-SoVITS.

        Args:
            text: Text to convert to speech
            use_cache: Whether to use cached audio if available
            convert_to_mp3: Whether to convert WAV to MP3 (for mobile compatibility)
            generate_lip_sync: Whether to generate lip sync timing data
            preprocess: Whether to clean text for TTS (remove markdown, emojis, etc.)

        Returns:
            Tuple of (path to generated audio file, lip sync data) or (None, None) if failed
        """
        if not text or not text.strip():
            return None, None

        tts_start = time.perf_counter()

        # Clean text for TTS (remove markdown, emojis, code blocks, etc.)
        if preprocess:
            text = clean_for_tts(text)

        if not text or not text.strip():
            return None, None

        # Determine output format based on conversion flag
        output_format = "mp3" if convert_to_mp3 else "wav"
        cache_path = self._get_cache_path(text, format=output_format)
        lip_sync_cache_path = self._get_lip_sync_cache_path(text)

        # Return cached file if it exists
        if use_cache and cache_path.exists():
            cache_ms = (time.perf_counter() - tts_start) * 1000
            lip_sync_data = None
            if lip_sync_cache_path.exists():
                try:
                    lip_sync_data = json.loads(lip_sync_cache_path.read_text())
                except Exception:
                    pass
            print(f"⏱️  TTS [CACHE HIT] {cache_ms:.0f}ms")
            return str(cache_path), lip_sync_data

        # Mock mode: Return None (no audio) but log what would be generated
        if self.mock_mode:
            return None, None

        try:
            # Prepare payload for GPT-SoVITS
            payload = {
                "text": text,
                "text_lang": self.text_lang,
                "ref_audio_path": self.ref_audio_path,
                "prompt_text": self.prompt_text,
                "prompt_lang": self.prompt_lang,
                "speed_factor": self.speed_factor,
                "text_split_method": "cut0",
                "streaming_mode": 1,
            }

            # Call GPT-SoVITS API (async with aiohttp)
            api_start = time.perf_counter()
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(self.sovits_url, json=payload) as response:
                    api_ms = (time.perf_counter() - api_start) * 1000

                    if response.status != 200:
                        print(f"⏱️  TTS [API ERROR] {api_ms:.0f}ms - Status: {response.status}")
                        return None, None

                    print(f"⏱️  TTS [GPT-SoVITS API] First byte in {api_ms:.0f}ms")

                    # Download full audio (this is where the actual generation time is)
                    download_start = time.perf_counter()
                    audio_content = await response.read()
                    download_ms = (time.perf_counter() - download_start) * 1000
                    print(f"⏱️  TTS [Audio Generation + Download] {download_ms:.0f}ms ({download_ms/1000:.2f}s) - {len(audio_content)/1024:.1f}KB")

                    # Save to disk
                    save_start = time.perf_counter()
                    wav_path = self.audio_dir / f"{cache_path.stem}_temp.wav" if convert_to_mp3 else cache_path
                    with open(wav_path, "wb") as f:
                        f.write(audio_content)
                    save_ms = (time.perf_counter() - save_start) * 1000
                    print(f"⏱️  TTS [Save to Disk] {save_ms:.0f}ms")

            # Generate text-based lip sync (near-instant, no Rhubarb needed)
            lip_sync_data = None
            if generate_lip_sync:
                audio_duration = get_wav_duration(str(wav_path))
                if audio_duration > 0:
                    lip_sync_data = generate_lip_sync_from_text(text, audio_duration)
                    if lip_sync_data:
                        lip_sync_cache_path.write_text(json.dumps(lip_sync_data))

            if convert_to_mp3:
                mp3_start = time.perf_counter()
                try:
                    proc = await asyncio.create_subprocess_exec(
                        "ffmpeg",
                        "-i", str(wav_path),
                        "-codec:a", "libmp3lame",
                        "-b:a", "128k",
                        "-ar", "44100",
                        "-ac", "1",
                        "-y",
                        str(cache_path),
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    await asyncio.wait_for(proc.communicate(), timeout=30)

                    mp3_ms = (time.perf_counter() - mp3_start) * 1000
                    if proc.returncode == 0:
                        wav_path.unlink()
                        print(f"⏱️  TTS [FFmpeg MP3] {mp3_ms:.0f}ms ({mp3_ms/1000:.2f}s)")
                    else:
                        print(f"⏱️  TTS [FFmpeg FAILED] {mp3_ms:.0f}ms")
                        return None, None

                except asyncio.TimeoutError:
                    if wav_path.exists():
                        wav_path.unlink()
                    return None, None
                except FileNotFoundError:
                    if wav_path.exists():
                        wav_path.unlink()
                    return None, None
                except Exception:
                    if wav_path.exists():
                        wav_path.unlink()
                    return None, None

            total_ms = (time.perf_counter() - tts_start) * 1000
            print(f"⏱️  TTS [TOTAL] {total_ms:.0f}ms ({total_ms/1000:.2f}s)")

            return str(cache_path), lip_sync_data

        except aiohttp.ClientError as e:
            print(f"⏱️  TTS [CONNECTION ERROR] {e}")
            return None, None
        except Exception as e:
            print(f"⏱️  TTS [ERROR] {e}")
            return None, None

    def clear_cache(self) -> int:
        """
        Clear all cached audio files.

        Returns:
            Number of files deleted
        """
        count = 0
        for file_path in self.audio_dir.glob("*.mp3"):
            file_path.unlink()
            count += 1
        # Also clear any remaining WAV files from old cache
        for file_path in self.audio_dir.glob("*.wav"):
            file_path.unlink()
            count += 1
        print(f"✓ Cleared {count} cached SoVITS audio files")
        return count

    def get_cache_size(self) -> int:
        """
        Get total size of cached audio files in bytes.

        Returns:
            Total cache size in bytes
        """
        total_size = sum(
            file_path.stat().st_size for file_path in self.audio_dir.glob("*.mp3")
        )
        total_size += sum(
            file_path.stat().st_size for file_path in self.audio_dir.glob("*.wav")
        )
        return total_size
