"""
Text-to-Speech integration for Mona using OpenAI TTS API.
"""

import asyncio
import json
import os
import hashlib
import time
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from openai import AsyncOpenAI

from lip_sync import get_lip_sync_generator


class MonaTTS:
    """Handles text-to-speech generation for Mona's responses."""

    def __init__(
        self,
        voice: str = "nova",
        model: str = "tts-1",
        audio_dir: str = "assets/audio_cache",
    ):
        """
        Initialize TTS with OpenAI client.

        Args:
            voice: OpenAI voice (alloy, echo, fable, onyx, nova, shimmer)
            model: TTS model (tts-1 or tts-1-hd)
            audio_dir: Directory to cache generated audio files
        """
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")

        self.client = AsyncOpenAI(api_key=api_key)
        self.voice = voice
        self.model = model

        # Setup audio cache directory
        self.audio_dir = Path(audio_dir)
        self.audio_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_path(self, text: str) -> Path:
        """Generate cache file path based on text hash."""
        text_hash = hashlib.md5(f"{text}_{self.voice}_{self.model}".encode()).hexdigest()
        return self.audio_dir / f"{text_hash}.mp3"

    def _get_lip_sync_cache_path(self, text: str) -> Path:
        """Generate cache file path for lip sync data."""
        text_hash = hashlib.md5(f"{text}_{self.voice}_{self.model}".encode()).hexdigest()
        return self.audio_dir / f"{text_hash}.lipsync.json"

    async def generate_speech(
        self,
        text: str,
        use_cache: bool = True,
        generate_lip_sync: bool = True
    ) -> Tuple[Optional[str], Optional[List[Dict[str, Any]]]]:
        """
        Generate speech audio from text.

        Args:
            text: Text to convert to speech
            use_cache: Whether to use cached audio if available
            generate_lip_sync: Whether to generate lip sync timing data

        Returns:
            Tuple of (path to generated audio file, lip sync data) or (None, None) if failed
        """
        if not text or not text.strip():
            return None, None

        cache_path = self._get_cache_path(text)
        lip_sync_cache_path = self._get_lip_sync_cache_path(text)

        # Return cached file if it exists
        if use_cache and cache_path.exists():
            print(f"✓ Using cached audio: {cache_path.name}")
            # Also load cached lip sync if available
            lip_sync_data = None
            if lip_sync_cache_path.exists():
                try:
                    lip_sync_data = json.loads(lip_sync_cache_path.read_text())
                    print(f"✓ Using cached lip sync data: {len(lip_sync_data)} cues")
                except Exception:
                    pass
            return str(cache_path), lip_sync_data

        try:
            print(f"⚡ Generating speech for: {text[:50]}...")
            tts_start = time.perf_counter()

            lip_sync_generator = get_lip_sync_generator() if generate_lip_sync else None
            use_wav_workflow = generate_lip_sync and lip_sync_generator and lip_sync_generator.is_available()

            if use_wav_workflow:
                # Get MP3 from OpenAI and save directly as final cache
                # (OpenAI's WAV has malformed headers that Rhubarb can't read)
                response = await self.client.audio.speech.create(
                    model=self.model,
                    voice=self.voice,
                    input=text,
                )
                cache_path.write_bytes(response.content)
                tts_ms = (time.perf_counter() - tts_start) * 1000
                print(f"✓ OpenAI TTS complete ({tts_ms:.0f}ms)")

                # Convert MP3 to WAV for Rhubarb (proper headers)
                wav_path = cache_path.with_suffix('.wav')
                convert_proc = await asyncio.create_subprocess_exec(
                    'ffmpeg', '-y', '-i', str(cache_path), str(wav_path),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await asyncio.wait_for(convert_proc.communicate(), timeout=30)

                if convert_proc.returncode != 0:
                    print(f"⚠ WAV conversion failed")
                    return str(cache_path), None  # Return MP3 but no lip sync

                # Run Rhubarb on WAV
                rhubarb_start = time.perf_counter()
                lip_sync_data = await lip_sync_generator.generate_lip_sync_async(
                    str(wav_path),
                    dialog_text=text
                )
                rhubarb_ms = (time.perf_counter() - rhubarb_start) * 1000

                # Clean up WAV
                if wav_path.exists():
                    wav_path.unlink()

                print(f"✓ Rhubarb: {rhubarb_ms:.0f}ms, {len(lip_sync_data) if lip_sync_data else 0} cues")
                if lip_sync_data:
                    lip_sync_cache_path.write_text(json.dumps(lip_sync_data))

            else:
                # No lip sync needed - just get MP3 directly
                response = await self.client.audio.speech.create(
                    model=self.model,
                    voice=self.voice,
                    input=text,
                )
                audio_content = response.content
                cache_path.write_bytes(audio_content)
                tts_ms = (time.perf_counter() - tts_start) * 1000
                print(f"✓ Audio saved: {cache_path.name} ({tts_ms:.0f}ms)")
                lip_sync_data = None

            return str(cache_path), lip_sync_data

        except Exception as e:
            print(f"✗ TTS generation failed: {e}")
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
        print(f"✓ Cleared {count} cached audio files")
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
        return total_size
