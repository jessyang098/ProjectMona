"""
GPT-SoVITS TTS Integration for Mona
Uses local GPT-SoVITS server for high-quality anime voice synthesis
"""

import hashlib
import requests
from pathlib import Path
from typing import Optional


class MonaTTSSoVITS:
    """Handles text-to-speech generation using GPT-SoVITS."""

    def __init__(
        self,
        sovits_url: str = "https://4io3lq5laazuh7-9880.proxy.runpod.net/tts",
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
            sovits_url: URL of the GPT-SoVITS API endpoint
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

        # Setup audio cache directory
        self.audio_dir = Path(audio_dir)
        self.audio_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_path(self, text: str) -> Path:
        """Generate cache file path based on text hash."""
        text_hash = hashlib.md5(
            f"{text}_{self.ref_audio_path}_{self.speed_factor}".encode()
        ).hexdigest()
        return self.audio_dir / f"{text_hash}.wav"

    async def generate_speech(self, text: str, use_cache: bool = True) -> Optional[str]:
        """
        Generate speech audio from text using GPT-SoVITS.

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
            print(f"✓ Using cached SoVITS audio: {cache_path.name}")
            return str(cache_path)

        try:
            print(f"⚡ Generating SoVITS speech for: {text[:50]}...")

            # Prepare payload for GPT-SoVITS
            payload = {
                "text": text,
                "text_lang": self.text_lang,
                "ref_audio_path": self.ref_audio_path,
                "prompt_text": self.prompt_text,
                "prompt_lang": self.prompt_lang,
                "speed_factor": self.speed_factor,
                "text_split_method": "cut5",  # Required by API
            }

            # Call GPT-SoVITS API
            response = requests.post(self.sovits_url, json=payload, timeout=30)
            response.raise_for_status()

            # Save audio file
            with open(cache_path, "wb") as f:
                f.write(response.content)

            print(f"✓ SoVITS audio saved: {cache_path.name}")
            return str(cache_path)

        except requests.exceptions.ConnectionError:
            print(f"✗ SoVITS server not running. Start GPT-SoVITS on {self.sovits_url}")
            return None
        except Exception as e:
            print(f"✗ SoVITS generation failed: {e}")
            return None

    def clear_cache(self) -> int:
        """
        Clear all cached audio files.

        Returns:
            Number of files deleted
        """
        count = 0
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
            file_path.stat().st_size for file_path in self.audio_dir.glob("*.wav")
        )
        return total_size
