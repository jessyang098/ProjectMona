"""
Text-based lip sync generation using phoneme estimation.
Generates mouth shape timing data for realistic lip sync animation.
"""

import re
import struct
import time
from typing import Optional, List, Dict, Any


# Mouth shapes mapped to VRM phoneme blend shapes
# Shapes: A, B, C, D, E, F, G, H, X
# VRM uses: aa (jaw open), ee (wide smile), ih (slight smile), oh (round), ou (pucker)
SHAPE_TO_VRM = {
    "A": {"aa": 0.0, "ee": 0.0, "ih": 0.0, "oh": 0.0, "ou": 0.15},   # Closed mouth (M, B, P) - lips pressed
    "B": {"aa": 0.4, "ee": 0.0, "ih": 0.25, "oh": 0.0, "ou": 0.0},   # Slightly open (K, S, T, D, N)
    "C": {"aa": 0.25, "ee": 0.85, "ih": 0.2, "oh": 0.0, "ou": 0.0},  # EE sound (beet, see) - wide smile
    "D": {"aa": 0.9, "ee": 0.0, "ih": 0.1, "oh": 0.0, "ou": 0.0},    # AA/AH sound (bat, father) - jaw open
    "E": {"aa": 0.55, "ee": 0.0, "ih": 0.0, "oh": 0.75, "ou": 0.0},  # OH sound (bought, go) - round open
    "F": {"aa": 0.2, "ee": 0.0, "ih": 0.0, "oh": 0.2, "ou": 0.8},    # OO/W sound (boot, two) - pucker
    "G": {"aa": 0.15, "ee": 0.0, "ih": 0.35, "oh": 0.0, "ou": 0.0},  # F/V sound - teeth on lip
    "H": {"aa": 0.35, "ee": 0.0, "ih": 0.15, "oh": 0.0, "ou": 0.0},  # L/R sound - tongue up
    "X": {"aa": 0.0, "ee": 0.0, "ih": 0.0, "oh": 0.0, "ou": 0.0, "_silence": True},  # Silence - closed
}

# Multi-character patterns (checked first, in order of length)
# These handle digraphs, common letter combinations, and silent letters
DIGRAPH_TO_SHAPE = {
    # Silent letter combinations
    "ght": "B",     # night, right - just the t sound
    "kn": "B",      # know, knee - just n sound
    "wr": "H",      # write, wrong - just r sound
    "mb": "A",      # lamb, climb - just m sound
    "mn": "A",      # autumn - just m sound

    # Consonant digraphs
    "th": "B",      # the, think - tongue between teeth
    "sh": "B",      # ship, fish - fricative
    "ch": "B",      # chip, match - affricate
    "wh": "F",      # what, where - rounded
    "ph": "G",      # phone - like F
    "ng": "B",      # sing, ring - nasal
    "ck": "B",      # back, pick - just k

    # Vowel digraphs/diphthongs
    "oo": "F",      # boot, food - OO sound
    "ee": "C",      # see, feet - EE sound
    "ea": "C",      # eat, sea - usually EE
    "ai": "C",      # rain, pain - AY sound (smile)
    "ay": "C",      # day, say - AY sound
    "ey": "C",      # they, grey - AY sound
    "ie": "C",      # pie, tie - usually EE or AY
    "oa": "E",      # boat, coat - OH sound
    "ow": "E",      # low, show - OH sound (but also OW as in cow)
    "ou": "D",      # out, loud - AH-OO diphthong, start with open
    "au": "E",      # auto, cause - AW sound
    "aw": "E",      # saw, law - AW sound
    "oi": "E",      # oil, coin - starts round
    "oy": "E",      # boy, toy - starts round
    "ue": "F",      # blue, true - OO sound
    "ew": "F",      # new, few - OO sound

    # Common endings
    "tion": "B",    # nation - shun sound
    "sion": "B",    # vision - zhun sound
    "ing": "B",     # running - ng sound
    "ed": "B",      # walked - d/t sound (often silent e)
}

# Single character mappings
CHAR_TO_SHAPE = {
    # Closed lips (bilabial)
    "m": "A", "b": "A", "p": "A",

    # Slightly open (alveolar/velar consonants)
    "k": "B", "s": "B", "t": "B", "d": "B", "n": "B",
    "g": "B", "z": "B", "c": "B", "j": "B", "q": "B",
    "x": "B", "h": "B",

    # EE shape (front vowels)
    "e": "C", "i": "C", "y": "C",

    # AA shape (open vowel)
    "a": "D",

    # OH shape (back rounded vowel)
    "o": "E",

    # OO shape (close rounded)
    "u": "F", "w": "F",

    # F/V sound (labiodental)
    "f": "G", "v": "G",

    # L/R sound (liquids)
    "l": "H", "r": "H",
}

# Punctuation that causes pauses
PAUSE_CHARS = {
    ".": 0.8,   # Full stop - longer pause
    ",": 0.4,   # Comma - medium pause
    "!": 0.8,   # Exclamation
    "?": 0.8,   # Question
    ";": 0.5,   # Semicolon
    ":": 0.5,   # Colon
    "-": 0.3,   # Dash
    "—": 0.4,   # Em dash
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


def _text_to_phonemes(text: str) -> List[tuple]:
    """
    Convert text to a list of (shape, weight) tuples.
    Weight is used for timing - pauses are shorter, vowels slightly longer.
    """
    text = text.lower()
    phonemes = []
    i = 0

    while i < len(text):
        matched = False

        # Check for digraphs/multi-char patterns (longest first)
        for length in [4, 3, 2]:
            if i + length <= len(text):
                chunk = text[i:i + length]
                if chunk in DIGRAPH_TO_SHAPE:
                    phonemes.append((DIGRAPH_TO_SHAPE[chunk], 1.0))
                    i += length
                    matched = True
                    break

        if matched:
            continue

        char = text[i]

        # Check for pause punctuation
        if char in PAUSE_CHARS:
            phonemes.append(("X", PAUSE_CHARS[char]))
            i += 1
            continue

        # Check for space (word boundary)
        if char == " ":
            phonemes.append(("X", 0.3))
            i += 1
            continue

        # Check single character
        if char in CHAR_TO_SHAPE:
            # Vowels get slightly more weight
            weight = 1.2 if char in "aeiou" else 1.0
            phonemes.append((CHAR_TO_SHAPE[char], weight))
            i += 1
            continue

        # Skip unknown characters (punctuation, numbers, etc.)
        i += 1

    return phonemes


def generate_lip_sync_from_text(
    text: str,
    audio_duration: float,
) -> Optional[List[Dict[str, Any]]]:
    """
    Generate lip sync data from text using phoneme estimation.

    Args:
        text: The spoken text
        audio_duration: Duration of the audio in seconds

    Returns:
        List of mouth cues with timing and VRM blend shape values.
    """
    if not text or audio_duration <= 0:
        return None

    gen_start = time.perf_counter()

    # Convert text to phoneme sequence
    phonemes = _text_to_phonemes(text)

    if not phonemes:
        return None

    # Merge consecutive identical shapes
    merged = []
    for shape, weight in phonemes:
        if merged and merged[-1][0] == shape:
            merged[-1] = (shape, merged[-1][1] + weight)
        else:
            merged.append((shape, weight))

    # Calculate total weight for timing distribution
    total_weight = sum(weight for _, weight in merged)
    if total_weight == 0:
        return None

    # Distribute timing across audio duration
    time_per_weight = audio_duration / total_weight
    current_time = 0.0
    lip_sync_data = []

    for shape, weight in merged:
        duration = weight * time_per_weight
        end_time = current_time + duration

        lip_sync_data.append({
            "start": round(current_time, 3),
            "end": round(end_time, 3),
            "shape": shape,
            "phonemes": SHAPE_TO_VRM.get(shape, SHAPE_TO_VRM["X"]),
        })

        current_time = end_time

    gen_ms = (time.perf_counter() - gen_start) * 1000
    print(f"⏱️  Lip Sync [Text-Based] {gen_ms:.1f}ms ({len(lip_sync_data)} cues, {audio_duration:.1f}s audio)")
    return lip_sync_data
