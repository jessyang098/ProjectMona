"""
GPT-SoVITS TTS Integration for Mona
Uses local GPT-SoVITS server for high-quality anime voice synthesis
"""

import hashlib
import requests
import subprocess
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

    def _get_cache_path(self, text: str, format: str = "wav") -> Path:
        """Generate cache file path based on text hash and format."""
        text_hash = hashlib.md5(
            f"{text}_{self.ref_audio_path}_{self.speed_factor}".encode()
        ).hexdigest()
        return self.audio_dir / f"{text_hash}.{format}"

    async def generate_speech(self, text: str, use_cache: bool = True, convert_to_mp3: bool = False) -> Optional[str]:
        """
        Generate speech audio from text using GPT-SoVITS.

        Args:
            text: Text to convert to speech
            use_cache: Whether to use cached audio if available
            convert_to_mp3: Whether to convert WAV to MP3 (for mobile compatibility)

        Returns:
            Path to generated audio file, or None if generation failed
        """
        if not text or not text.strip():
            return None

        # Determine output format based on conversion flag
        output_format = "mp3" if convert_to_mp3 else "wav"
        cache_path = self._get_cache_path(text, format=output_format)

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
                "text_split_method": "cut0",  # cut0 = faster, simpler splitting
                "streaming_mode": 1,  # Mode 1: return fragments without streaming (faster response)
            }

            # Call GPT-SoVITS API
            print(f"📤 Sending payload to {self.sovits_url}:")
            print(f"   {payload}")
            response = requests.post(self.sovits_url, json=payload, timeout=30)

            # Log response for debugging
            print(f"📥 Response status: {response.status_code}")
            if response.status_code != 200:
                print(f"❌ Error response body: {response.text}")

            response.raise_for_status()

            # Only convert to MP3 if requested (for mobile clients)
            if convert_to_mp3:
                # Save WAV file temporarily
                wav_path = self.audio_dir / f"{cache_path.stem}_temp.wav"
                with open(wav_path, "wb") as f:
                    f.write(response.content)

                print(f"✓ SoVITS WAV generated, converting to MP3 for mobile compatibility...")

                # Convert WAV to MP3 using ffmpeg directly for better reliability
                try:
                    result = subprocess.run(
                        [
                            "ffmpeg",
                            "-i", str(wav_path),  # Input WAV file
                            "-codec:a", "libmp3lame",  # MP3 encoder
                            "-b:a", "128k",  # 128kbps bitrate
                            "-ar", "44100",  # 44.1kHz sample rate (standard for web)
                            "-ac", "1",  # Mono audio
                            "-y",  # Overwrite output file
                            str(cache_path)  # Output MP3 file
                        ],
                        capture_output=True,
                        text=True,
                        timeout=30
                    )

                    if result.returncode == 0:
                        wav_path.unlink()  # Delete temporary WAV file
                        print(f"✓ SoVITS audio converted to MP3: {cache_path.name}")
                    else:
                        print(f"❌ ffmpeg conversion failed with return code {result.returncode}")
                        print(f"   stderr: {result.stderr[:200]}")
                        return None

                except subprocess.TimeoutExpired:
                    print(f"❌ MP3 conversion timed out after 30 seconds")
                    if wav_path.exists():
                        wav_path.unlink()
                    return None
                except FileNotFoundError:
                    print(f"❌ ffmpeg not found - cannot convert to MP3 for mobile")
                    print(f"   Install ffmpeg: apt-get install ffmpeg (or brew install ffmpeg on macOS)")
                    if wav_path.exists():
                        wav_path.unlink()
                    return None
                except Exception as e:
                    print(f"❌ MP3 conversion failed: {e}")
                    if wav_path.exists():
                        wav_path.unlink()
                    return None
            else:
                # Save WAV directly (for desktop clients)
                with open(cache_path, "wb") as f:
                    f.write(response.content)
                print(f"✓ SoVITS audio saved as WAV: {cache_path.name}")

            return str(cache_path)

        except requests.exceptions.ConnectionError:
            print(f"✗ SoVITS server not running. Start GPT-SoVITS on {self.sovits_url}")
            return None
        except requests.exceptions.HTTPError as e:
            print(f"✗ SoVITS API error: {e}")
            print(f"✗ Response body: {e.response.text if hasattr(e, 'response') else 'No response body'}")
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
