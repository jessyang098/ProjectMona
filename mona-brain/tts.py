"""
Text-to-Speech integration for Mona using OpenAI TTS API.
"""

import os
import hashlib
from pathlib import Path
from typing import Optional
from openai import OpenAI


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

        self.client = OpenAI(api_key=api_key)
        self.voice = voice
        self.model = model

        # Setup audio cache directory
        self.audio_dir = Path(audio_dir)
        self.audio_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_path(self, text: str) -> Path:
        """Generate cache file path based on text hash."""
        text_hash = hashlib.md5(f"{text}_{self.voice}_{self.model}".encode()).hexdigest()
        return self.audio_dir / f"{text_hash}.mp3"

    async def generate_speech(self, text: str, use_cache: bool = True) -> Optional[str]:
        """
        Generate speech audio from text.

        Args:
            text: Text to convert to speech
            use_cache: Whether to use cached audio if available

        Returns:
            Path to generated audio file, or None if generation failed
        """
        if not text or not text.strip():
            return None

        cache_path = self._get_cache_path(text)

        # Return cached file if it exists
        if use_cache and cache_path.exists():
            print(f"✓ Using cached audio: {cache_path.name}")
            return str(cache_path)

        try:
            print(f"⚡ Generating speech for: {text[:50]}...")

            # Generate speech using OpenAI TTS
            response = self.client.audio.speech.create(
                model=self.model,
                voice=self.voice,
                input=text,
            )

            # Save to cache
            response.stream_to_file(cache_path)
            print(f"✓ Audio saved: {cache_path.name}")

            return str(cache_path)

        except Exception as e:
            print(f"✗ TTS generation failed: {e}")
            return None

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
