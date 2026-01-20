"""
Lip Sync Generation using Rhubarb Lip Sync
Analyzes audio files and generates mouth shape timing data for realistic lip sync animation.
"""

import asyncio
import json
import os
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
            "/workspace/rhubarb/rhubarb",  # Runpod workspace
            "/usr/local/bin/rhubarb",
            "/usr/bin/rhubarb",
            os.path.expanduser("~/rhubarb/rhubarb"),
            os.path.expanduser("~/Rhubarb-Lip-Sync-1.14.0-macOS/rhubarb"),  # macOS download location
            "./rhubarb/rhubarb",
            "rhubarb",  # In PATH
        ]

        for path in common_paths:
            if os.path.isfile(path) and os.access(path, os.X_OK):
                return path
            # Check if it's in PATH
            if path == "rhubarb":
                try:
                    result = subprocess.run(
                        ["which", "rhubarb"],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    if result.returncode == 0:
                        return result.stdout.strip()
                except Exception:
                    pass

        return None

    def generate_lip_sync(
        self,
        audio_path: str,
        dialog_text: Optional[str] = None,
        extended_shapes: bool = False
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Generate lip sync timing data from an audio file.

        Args:
            audio_path: Path to the audio file (WAV or MP3)
            dialog_text: Optional transcript to improve accuracy
            extended_shapes: Whether to use extended mouth shapes (G, H)

        Returns:
            List of mouth cues with timing and VRM blend shape values, or None if failed.
            Each cue: {"start": float, "end": float, "shape": str, "phonemes": dict}
        """
        if not self.rhubarb_path:
            return None

        if not os.path.isfile(audio_path):
            print(f"✗ Audio file not found: {audio_path}")
            return None

        try:
            # Build command
            cmd = [
                self.rhubarb_path,
                "-f", "json",  # JSON output format
                "-r", "phonetic",  # Use phonetic recognition (faster)
            ]

            if extended_shapes:
                cmd.append("--extendedShapes")
                cmd.append("GHX")

            # Add dialog text for better accuracy if provided
            if dialog_text:
                # Write dialog to temp file
                dialog_file = Path(audio_path).with_suffix(".txt")
                dialog_file.write_text(dialog_text)
                cmd.extend(["-d", str(dialog_file)])

            cmd.append(audio_path)

            # Run rhubarb
            rhubarb_start = time.perf_counter()
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30  # 30 second timeout
            )
            rhubarb_ms = (time.perf_counter() - rhubarb_start) * 1000

            # Clean up dialog file
            if dialog_text:
                dialog_file = Path(audio_path).with_suffix(".txt")
                if dialog_file.exists():
                    dialog_file.unlink()

            if result.returncode != 0:
                print(f"⏱️  Lip Sync [RHUBARB FAILED] {rhubarb_ms:.0f}ms - {result.stderr}")
                return None

            # Parse JSON output
            parse_start = time.perf_counter()
            data = json.loads(result.stdout)
            mouth_cues = data.get("mouthCues", [])

            # Convert to our format with VRM phoneme values
            lip_sync_data = []
            for i, cue in enumerate(mouth_cues):
                shape = cue.get("value", "X")
                start = cue.get("start", 0)

                # Calculate end time from next cue or add 0.1s default
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

        except subprocess.TimeoutExpired:
            print("✗ Rhubarb timed out after 30 seconds")
            return None
        except json.JSONDecodeError as e:
            print(f"✗ Failed to parse Rhubarb output: {e}")
            return None
        except Exception as e:
            print(f"✗ Lip sync generation failed: {e}")
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

            cmd.append(audio_path)

            # Run rhubarb asynchronously
            rhubarb_start = time.perf_counter()
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
            rhubarb_ms = (time.perf_counter() - rhubarb_start) * 1000

            # Clean up dialog file
            if dialog_file and dialog_file.exists():
                dialog_file.unlink()

            if proc.returncode != 0:
                print(f"⏱️  Lip Sync [RHUBARB FAILED] {rhubarb_ms:.0f}ms - {stderr.decode()}")
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
