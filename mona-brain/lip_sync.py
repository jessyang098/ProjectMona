"""
Lip Sync Generation using Rhubarb Lip Sync or text-based phoneme estimation.
Analyzes audio files and generates mouth shape timing data for realistic lip sync animation.
"""

import asyncio
import json
import os
import struct
import subprocess
import time
from pathlib import Path
from typing import Optional, List, Dict, Any


# Rhubarb mouth shapes mapped to VRM phoneme blend shapes
# Rhubarb outputs: A, B, C, D, E, F, G, H, X
# VRM uses: aa (jaw open), ee (wide smile), ih (slight smile), oh (round), ou (pucker)
#
# Key improvements for natural lip sync:
# 1. "A" shape (closed mouth M/B/P) now uses ou for lip compression
# 2. Blend shapes are combined more naturally (real speech uses multiple shapes)
# 3. Distinct shapes for each phoneme category to improve enunciation
# 4. "X" (silence) closes mouth completely for clear word boundaries
RHUBARB_TO_VRM = {
    "A": {"aa": 0.0, "ee": 0.0, "ih": 0.0, "oh": 0.0, "ou": 0.15},  # Closed mouth (M, B, P) - lips pressed together
    "B": {"aa": 0.4, "ee": 0.0, "ih": 0.25, "oh": 0.0, "ou": 0.0},  # Slightly open (consonants like K, S, T)
    "C": {"aa": 0.25, "ee": 0.85, "ih": 0.2, "oh": 0.0, "ou": 0.0},  # EE sound (beet, see) - wide smile, less jaw
    "D": {"aa": 0.9, "ee": 0.0, "ih": 0.1, "oh": 0.0, "ou": 0.0},  # AA sound (bat, back) - jaw dropped wide
    "E": {"aa": 0.55, "ee": 0.0, "ih": 0.0, "oh": 0.75, "ou": 0.0},  # AH/OH sound (bought, dog) - round open
    "F": {"aa": 0.2, "ee": 0.0, "ih": 0.0, "oh": 0.2, "ou": 0.8},  # OO sound (boot, two) - tight pucker
    "G": {"aa": 0.15, "ee": 0.0, "ih": 0.35, "oh": 0.0, "ou": 0.0},  # F/V sound - teeth on lip, slight tension
    "H": {"aa": 0.35, "ee": 0.0, "ih": 0.15, "oh": 0.0, "ou": 0.0},  # L sound - tongue up, mouth slightly open
    "X": {"aa": 0.0, "ee": 0.0, "ih": 0.0, "oh": 0.0, "ou": 0.0, "_silence": True},  # Silence/rest - mouth fully closed
}


# Grapheme-to-Rhubarb shape mapping for text-based lip sync
# Maps lowercase letter(s) to Rhubarb mouth shapes (A-H, X)
GRAPHEME_TO_SHAPE = {
    # A - Closed lips (M, B, P)
    "m": "A", "b": "A", "p": "A",
    # B - Slightly open (most consonants)
    "k": "B", "s": "B", "t": "B", "d": "B", "n": "B",
    "g": "B", "z": "B", "c": "B", "j": "B", "q": "B",
    "x": "B", "h": "B",
    # C - EE shape (wide smile)
    "e": "C", "i": "C", "y": "C",
    # D - AA shape (jaw open)
    "a": "D",
    # E - OH shape (round open)
    "o": "E",
    # F - OO shape (pucker)
    "u": "F", "w": "F",
    # G - F/V sound (teeth on lip)
    "f": "G", "v": "G",
    # H - L/R sound (tongue up)
    "l": "H", "r": "H",
}


def get_wav_duration(wav_path: str) -> float:
    """Get duration of a WAV file by reading its header. Returns seconds."""
    try:
        with open(wav_path, "rb") as f:
            f.read(22)  # skip to num_channels
            num_channels = struct.unpack("<H", f.read(2))[0]
            sample_rate = struct.unpack("<I", f.read(4))[0]
            f.read(6)  # skip byte_rate(4) + block_align(2)
            bits_per_sample = struct.unpack("<H", f.read(2))[0]
            # Find "data" chunk
            while True:
                chunk_id = f.read(4)
                if not chunk_id:
                    break
                chunk_size = struct.unpack("<I", f.read(4))[0]
                if chunk_id == b"data":
                    bytes_per_sample = bits_per_sample // 8
                    return chunk_size / (sample_rate * num_channels * bytes_per_sample)
                f.seek(chunk_size, 1)  # skip non-data chunks
    except Exception as e:
        print(f"⏱️  Lip Sync [WAV Duration ERROR] {e}")
    return 0.0


def generate_lip_sync_from_text(
    text: str,
    audio_duration: float,
) -> Optional[List[Dict[str, Any]]]:
    """
    Generate lip sync data from text using grapheme-to-phoneme estimation.
    Much faster than Rhubarb (~0ms vs ~3000ms) at the cost of less accurate timing.

    Args:
        text: The spoken text
        audio_duration: Duration of the audio in seconds

    Returns:
        List of mouth cues in the same format as Rhubarb output.
    """
    if not text or audio_duration <= 0:
        return None

    gen_start = time.perf_counter()

    # Build phoneme sequence: each character maps to a shape, spaces become X (silence)
    shapes = []
    for char in text.lower():
        if char in GRAPHEME_TO_SHAPE:
            shapes.append(GRAPHEME_TO_SHAPE[char])
        elif char == " ":
            shapes.append("X")
        # Skip punctuation and other characters (they don't produce mouth shapes)

    if not shapes:
        return None

    # Merge consecutive identical shapes for more natural timing
    merged = []
    for shape in shapes:
        if merged and merged[-1][0] == shape:
            merged[-1] = (shape, merged[-1][1] + 1)
        else:
            merged.append((shape, 1))

    # Distribute timing across audio duration
    # Give silence (X) less weight than speech shapes
    total_weight = sum(
        count * (0.3 if shape == "X" else 1.0)
        for shape, count in merged
    )
    if total_weight == 0:
        return None

    time_per_weight = audio_duration / total_weight
    current_time = 0.0
    lip_sync_data = []

    for shape, count in merged:
        weight = count * (0.3 if shape == "X" else 1.0)
        duration = weight * time_per_weight
        end_time = current_time + duration

        lip_sync_data.append({
            "start": round(current_time, 3),
            "end": round(end_time, 3),
            "shape": shape,
            "phonemes": RHUBARB_TO_VRM.get(shape, RHUBARB_TO_VRM["X"]),
        })

        current_time = end_time

    gen_ms = (time.perf_counter() - gen_start) * 1000
    print(f"⏱️  Lip Sync [Text-Based] {gen_ms:.1f}ms ({len(lip_sync_data)} cues, {audio_duration:.1f}s audio)")
    return lip_sync_data


class LipSyncGenerator:
    """Generates lip sync timing data from audio files using Rhubarb."""

    def __init__(self, rhubarb_path: Optional[str] = None):
        """
        Initialize the lip sync generator.

        Args:
            rhubarb_path: Path to the rhubarb executable. If None, tries common locations.
        """
        self.rhubarb_path = rhubarb_path or self._find_rhubarb()
        if self.rhubarb_path:
            print(f"✓ Rhubarb lip sync initialized: {self.rhubarb_path}")
        else:
            print("⚠ Rhubarb not found. Lip sync generation disabled.")
            print("  Install: wget https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.14.0/Rhubarb-Lip-Sync-1.14.0-Linux.zip")

    def _find_rhubarb(self) -> Optional[str]:
        """Find the rhubarb executable in common locations."""
        common_paths = [
            "./rhubarb/rhubarb.exe",  # Windows local
            "./rhubarb/rhubarb",      # Linux/Mac local
            "/workspace/rhubarb/rhubarb",  # Runpod workspace
            "/usr/local/bin/rhubarb",
            "/usr/bin/rhubarb",
            os.path.expanduser("~/rhubarb/rhubarb"),
            os.path.expanduser("~/Rhubarb-Lip-Sync-1.14.0-macOS/rhubarb"),  # macOS download location
        ]

        for path in common_paths:
            if os.path.isfile(path):
                return path

        # Check if rhubarb is in PATH
        try:
            cmd = "where" if os.name == "nt" else "which"
            result = subprocess.run(
                [cmd, "rhubarb"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                return result.stdout.strip().split('\n')[0]
        except Exception:
            pass

        return None

    def is_available(self) -> bool:
        """Check if Rhubarb is available."""
        return self.rhubarb_path is not None

    async def generate_lip_sync_async(
        self,
        audio_path: str,
        dialog_text: Optional[str] = None,
        extended_shapes: bool = False
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Async version of generate_lip_sync using asyncio subprocess.

        Args:
            audio_path: Path to the audio file (WAV or MP3)
            dialog_text: Optional transcript to improve accuracy
            extended_shapes: Whether to use extended mouth shapes (G, H)

        Returns:
            List of mouth cues with timing and VRM blend shape values, or None if failed.
        """
        if not self.rhubarb_path:
            return None

        if not os.path.isfile(audio_path):
            print(f"✗ Audio file not found: {audio_path}")
            return None

        try:
            # Resample audio to 16kHz PCM for Rhubarb compatibility
            # Rhubarb fails on non-standard sample rates (e.g. 32kHz from GPT-SoVITS)
            resampled_path = None
            try:
                resample_start = time.perf_counter()
                resample_proc = await asyncio.create_subprocess_exec(
                    "ffmpeg", "-i", audio_path, "-ar", "16000", "-acodec", "pcm_s16le", "-ac", "1", "-y",
                    str(Path(audio_path).with_suffix(".rhubarb.wav")),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                resample_stdout, resample_stderr = await asyncio.wait_for(resample_proc.communicate(), timeout=10)
                resample_ms = (time.perf_counter() - resample_start) * 1000
                if resample_proc.returncode == 0:
                    resampled_path = str(Path(audio_path).with_suffix(".rhubarb.wav"))
                    print(f"⏱️  Lip Sync [Resample] {resample_ms:.0f}ms -> 16kHz PCM")
                else:
                    print(f"⏱️  Lip Sync [Resample FAILED] {resample_ms:.0f}ms - {resample_stderr.decode()}")
            except Exception as e:
                print(f"⏱️  Lip Sync [Resample ERROR] {e}")

            rhubarb_input = resampled_path or audio_path

            # Build command
            cmd = [
                self.rhubarb_path,
                "-f", "json",
                "-r", "phonetic",
            ]

            if extended_shapes:
                cmd.extend(["--extendedShapes", "GHX"])

            # Add dialog text for better accuracy if provided
            dialog_file = None
            if dialog_text:
                dialog_file = Path(audio_path).with_suffix(".txt")
                dialog_file.write_text(dialog_text)
                cmd.extend(["-d", str(dialog_file)])
                print(f"⏱️  Lip Sync [Dialog] provided ({len(dialog_text)} chars): \"{dialog_text[:80]}{'...' if len(dialog_text) > 80 else ''}\"")
            else:
                print("⏱️  Lip Sync [Dialog] none provided (audio-only recognition)")

            cmd.append(rhubarb_input)
            print(f"⏱️  Lip Sync [CMD] {' '.join(cmd)}")

            # Run rhubarb asynchronously
            rhubarb_start = time.perf_counter()
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
            rhubarb_ms = (time.perf_counter() - rhubarb_start) * 1000

            # Log stderr even on success (Rhubarb reports warnings there)
            stderr_text = stderr.decode().strip()
            if stderr_text:
                print(f"⏱️  Lip Sync [Rhubarb stderr] {stderr_text}")

            # Clean up temp files
            if dialog_file and dialog_file.exists():
                dialog_file.unlink()
            if resampled_path and Path(resampled_path).exists():
                Path(resampled_path).unlink()

            if proc.returncode != 0:
                print(f"⏱️  Lip Sync [RHUBARB FAILED] {rhubarb_ms:.0f}ms (exit code {proc.returncode})")
                return None

            # Parse JSON output
            parse_start = time.perf_counter()
            data = json.loads(stdout.decode())
            mouth_cues = data.get("mouthCues", [])

            # Convert to our format with VRM phoneme values
            lip_sync_data = []
            for i, cue in enumerate(mouth_cues):
                shape = cue.get("value", "X")
                start = cue.get("start", 0)

                if i + 1 < len(mouth_cues):
                    end = mouth_cues[i + 1].get("start", start + 0.1)
                else:
                    end = start + 0.1

                lip_sync_data.append({
                    "start": start,
                    "end": end,
                    "shape": shape,
                    "phonemes": RHUBARB_TO_VRM.get(shape, RHUBARB_TO_VRM["X"])
                })

            parse_ms = (time.perf_counter() - parse_start) * 1000
            total_ms = rhubarb_ms + parse_ms
            print(f"⏱️  Lip Sync [Rhubarb] {rhubarb_ms:.0f}ms | [Parse] {parse_ms:.0f}ms | [TOTAL] {total_ms:.0f}ms ({len(lip_sync_data)} cues)")
            return lip_sync_data

        except asyncio.TimeoutError:
            print("✗ Rhubarb timed out after 30 seconds")
            return None
        except json.JSONDecodeError as e:
            print(f"✗ Failed to parse Rhubarb output: {e}")
            return None
        except Exception as e:
            print(f"✗ Lip sync generation failed: {e}")
            return None


# Global instance for easy access
_lip_sync_generator: Optional[LipSyncGenerator] = None


def get_lip_sync_generator() -> LipSyncGenerator:
    """Get or create the global lip sync generator."""
    global _lip_sync_generator
    if _lip_sync_generator is None:
        _lip_sync_generator = LipSyncGenerator()
    return _lip_sync_generator
