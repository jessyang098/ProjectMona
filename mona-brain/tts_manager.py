"""
TTS Manager - Centralizes TTS engine selection, fallback cascade, and timing.

All TTS engines share the same interface:
    generate_speech(text, generate_lip_sync=True) -> (audio_path_str | None, lip_sync_data | None)

The manager tries the requested engine first, then falls back through
sovits -> openai to ensure audio is always generated when possible.
"""

import time
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any


class TTSManager:
    """Manages TTS engine selection with fallback cascade and timing."""

    def __init__(self):
        self.sovits = None       # MonaTTSSoVITS instance
        self.fishspeech = None   # MonaTTSFishSpeech instance
        self.cartesia = None     # MonaTTSCartesia instance
        self.openai = None       # MonaTTS instance (OpenAI TTS)

    def initialize(self, sovits=None, fishspeech=None, cartesia=None, openai_tts=None):
        """Set available TTS engine instances."""
        self.sovits = sovits
        self.fishspeech = fishspeech
        self.cartesia = cartesia
        self.openai = openai_tts

    async def generate(
        self,
        text: str,
        engine_preference: str = "sovits",
        generate_lip_sync: bool = True,
    ) -> Tuple[Optional[str], Optional[List[Dict[str, Any]]], Optional[str], float]:
        """
        Generate speech with fallback cascade.

        Args:
            text: Preprocessed text to synthesize.
            engine_preference: Requested engine ("sovits", "fishspeech", "cartesia", "openai").
            generate_lip_sync: Whether to generate lip sync timing data.

        Returns:
            (audio_url, lip_sync_data, used_engine, duration_seconds)
            audio_url is like "/audio/filename.wav" or None if all engines failed.
        """
        tts_start = time.time()
        audio_url = None
        lip_sync_data = None
        used_engine = None

        # Try requested engine first
        audio_url, lip_sync_data = await self._try_engine(
            engine_preference, text, generate_lip_sync
        )
        if audio_url:
            used_engine = engine_preference

        # Fallback to sovits if requested engine failed
        if not audio_url and engine_preference != "sovits":
            audio_url, lip_sync_data = await self._try_engine(
                "sovits", text, generate_lip_sync
            )
            if audio_url:
                used_engine = "sovits (fallback)"

        # Fallback to openai as last resort
        if not audio_url and engine_preference != "openai":
            fallback_url, fallback_lip_sync = await self._try_engine(
                "openai", text, generate_lip_sync
            )
            if fallback_url:
                audio_url = fallback_url
                used_engine = "openai (fallback)"
                # Use OpenAI lip sync if we don't have any yet
                if not lip_sync_data and fallback_lip_sync:
                    lip_sync_data = fallback_lip_sync

        duration = time.time() - tts_start
        text_preview = text[:50] + "..." if len(text) > 50 else text
        print(f"TTS [{used_engine or 'none'}] generated in {duration:.2f}s for '{text_preview}'")
        if used_engine and engine_preference not in (used_engine or ""):
            print(f"TTS requested: {engine_preference}, used: {used_engine}")

        return (audio_url, lip_sync_data, used_engine, duration)

    async def _try_engine(
        self,
        engine: str,
        text: str,
        generate_lip_sync: bool,
    ) -> Tuple[Optional[str], Optional[List[Dict[str, Any]]]]:
        """Try generating speech with a specific engine. Returns (audio_url, lip_sync) or (None, None)."""
        try:
            instance = self._get_engine(engine)
            if instance is None:
                return None, None

            audio_path, lip_sync_data = await instance.generate_speech(
                text, generate_lip_sync=generate_lip_sync
            )
            if audio_path:
                audio_url = f"/audio/{Path(audio_path).name}"
                return audio_url, lip_sync_data
        except Exception as e:
            print(f"TTS [{engine}] failed: {e}")
        return None, None

    def _get_engine(self, engine: str):
        """Get the engine instance, checking mock_mode where applicable."""
        if engine == "sovits":
            return self.sovits
        elif engine == "fishspeech":
            if self.fishspeech and not getattr(self.fishspeech, "mock_mode", False):
                return self.fishspeech
            return None
        elif engine == "cartesia":
            if self.cartesia and not getattr(self.cartesia, "mock_mode", False):
                return self.cartesia
            return None
        elif engine == "openai":
            return self.openai
        return None


# Global TTS manager instance
tts_manager = TTSManager()
