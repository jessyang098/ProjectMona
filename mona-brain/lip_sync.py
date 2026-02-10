"""
Lip sync generation using IPA phoneme analysis (via espeak-ng/phonemizer).
Falls back to character-based estimation when phonemizer is not available.
Generates mouth shape timing data for realistic VRM lip sync animation.
"""

import time
import wave
from typing import Optional, List, Dict, Any

# Try to import phonemizer for IPA-based lip sync
# Pre-initialize the EspeakBackend to avoid ~1800ms subprocess startup per call
_HAS_PHONEMIZER = False
_espeak_backend = None
_espeak_separator = None
try:
    from phonemizer.backend import EspeakBackend
    from phonemizer.separator import Separator
    _espeak_separator = Separator(phone=" ", word=" | ", syllable="")
    _espeak_backend = EspeakBackend("en-us")
    _HAS_PHONEMIZER = True
    print("Lip Sync: espeak-ng available — using IPA-based lip sync (<1ms per call)")
except (ImportError, RuntimeError) as e:
    print(f"Lip Sync: espeak-ng not available ({e}) — using character-based fallback")


# ============================================================
# Mouth shapes → VRM blend shape weights
# Shapes: A, B, C, D, E, F, G, H, X
# VRM uses: aa (jaw open), ee (wide), ih (slight), oh (round), ou (pucker)
# ============================================================
SHAPE_TO_VRM = {
    "A": {"aa": 0.0, "ee": 0.0, "ih": 0.0, "oh": 0.0, "ou": 0.15},   # Closed (M, B, P)
    "B": {"aa": 0.4, "ee": 0.0, "ih": 0.25, "oh": 0.0, "ou": 0.0},   # Slightly open (K, S, T)
    "C": {"aa": 0.25, "ee": 0.85, "ih": 0.2, "oh": 0.0, "ou": 0.0},  # EE (wide smile)
    "D": {"aa": 0.9, "ee": 0.0, "ih": 0.1, "oh": 0.0, "ou": 0.0},    # AA/AH (jaw open)
    "E": {"aa": 0.55, "ee": 0.0, "ih": 0.0, "oh": 0.75, "ou": 0.0},  # OH (round open)
    "F": {"aa": 0.2, "ee": 0.0, "ih": 0.0, "oh": 0.2, "ou": 0.8},    # OO/W (pucker)
    "G": {"aa": 0.15, "ee": 0.0, "ih": 0.35, "oh": 0.0, "ou": 0.0},  # F/V (teeth on lip)
    "H": {"aa": 0.35, "ee": 0.0, "ih": 0.15, "oh": 0.0, "ou": 0.0},  # L/R (tongue up)
    "X": {"aa": 0.0, "ee": 0.0, "ih": 0.0, "oh": 0.0, "ou": 0.0, "_silence": True},
}


# ============================================================
# IPA phoneme → mouth shape mapping (used by phonemizer engine)
# ============================================================
IPA_TO_SHAPE = {
    # Bilabial stops/nasals — closed lips (Shape A)
    "p": "A", "b": "A", "m": "A",

    # Labiodental fricatives — teeth on lip (Shape G)
    "f": "G", "v": "G",

    # Dental fricatives — tongue between teeth (Shape B)
    "θ": "B", "ð": "B",

    # Alveolar stops/fricatives/nasals (Shape B)
    "t": "B", "d": "B", "s": "B", "z": "B", "n": "B",
    "ɾ": "B",  # alveolar tap

    # Postalveolar fricatives/affricates (Shape B)
    "ʃ": "B", "ʒ": "B",
    "tʃ": "B", "dʒ": "B",

    # Velar stops/nasals (Shape B)
    "k": "B", "ɡ": "B", "g": "B", "ŋ": "B",

    # Glottal (Shape B)
    "h": "B", "ɦ": "B", "ʔ": "B",

    # Liquids (Shape H — tongue up)
    "l": "H", "ɹ": "H", "r": "H", "ɻ": "H",
    "ɫ": "H",  # dark L

    # Semivowels
    "w": "F",  # rounded → pucker
    "j": "C",  # palatal → smile/EE

    # ---- VOWELS ----

    # Close front (EE shape — Shape C)
    "i": "C", "iː": "C", "ɪ": "C",

    # Mid front (Shape C, slightly less wide)
    "e": "C", "eɪ": "C", "ɛ": "C", "eː": "C",

    # Open front (Shape D — jaw open)
    "æ": "D",

    # Open/central (Shape D — jaw open)
    "a": "D", "aː": "D", "ɑ": "D", "ɑː": "D",
    "ʌ": "D", "ɐ": "D",

    # Schwa/reduced (Shape B — slight opening)
    "ə": "B", "ɚ": "H",

    # Mid back rounded (Shape E — OH)
    "ɔ": "E", "ɔː": "E", "o": "E", "oː": "E",

    # Close back rounded (Shape F — OO/pucker)
    "u": "F", "uː": "F", "ʊ": "F",

    # Diphthongs (use starting position)
    "aɪ": "D",   # as in "my" — starts open
    "aʊ": "D",   # as in "now" — starts open
    "ɔɪ": "E",   # as in "boy" — starts round
    "oʊ": "E",   # as in "go" — starts round
    "eɪ": "C",   # as in "day" — starts front

    # R-colored vowels (Shape H)
    "ɝ": "H", "ɜː": "H", "ɜ": "H",
    "ɑːɹ": "H",  # as in "car"
}

# Duration weights for phoneme types (affects timing distribution)
PHONEME_WEIGHTS = {
    "vowel": 1.3,       # vowels are naturally longer
    "diphthong": 1.6,   # diphthongs take more time
    "fricative": 0.9,   # fricatives are quick
    "stop": 0.7,        # stops are very short
    "nasal": 1.0,       # nasals are medium
    "liquid": 1.1,      # liquids are slightly longer
    "silence": 1.0,     # pauses
}

# Classify IPA phonemes by type for weight assignment
_VOWEL_PHONES = set("aeɛiɪɔouʊʌæəɚɝɐɑɜ")
_DIPHTHONG_STARTS = {"aɪ", "aʊ", "ɔɪ", "oʊ", "eɪ"}
_FRICATIVES = {"f", "v", "s", "z", "ʃ", "ʒ", "θ", "ð", "h", "ɦ"}
_STOPS = {"p", "b", "t", "d", "k", "g", "ɡ", "ʔ"}
_NASALS = {"m", "n", "ŋ"}
_LIQUIDS = {"l", "ɹ", "r", "ɻ", "ɫ", "w", "j"}


def _get_phoneme_weight(phone: str) -> float:
    """Get duration weight for a phoneme based on its type."""
    if phone in _DIPHTHONG_STARTS:
        return PHONEME_WEIGHTS["diphthong"]
    if len(phone) == 1 and phone in _VOWEL_PHONES:
        return PHONEME_WEIGHTS["vowel"]
    if phone.rstrip("ː") in _VOWEL_PHONES:
        return PHONEME_WEIGHTS["vowel"]
    if phone in _FRICATIVES:
        return PHONEME_WEIGHTS["fricative"]
    if phone in _STOPS:
        return PHONEME_WEIGHTS["stop"]
    if phone in _NASALS:
        return PHONEME_WEIGHTS["nasal"]
    if phone in _LIQUIDS:
        return PHONEME_WEIGHTS["liquid"]
    return 1.0


def _ipa_to_shapes(ipa_string: str) -> List[tuple]:
    """
    Convert an IPA string from phonemizer into (shape, weight) tuples.
    Handles multi-character IPA symbols (diphthongs, long vowels).
    """
    shapes = []
    phones = ipa_string.split()

    for phone in phones:
        if phone == "|":
            # Word boundary → short silence
            shapes.append(("X", 0.3))
            continue

        if not phone or phone.isspace():
            continue

        # Strip stress markers
        clean = phone.lstrip("ˈˌ").rstrip("ː")

        # Try full phone first (handles diphthongs like "oʊ", "aɪ")
        if phone in IPA_TO_SHAPE:
            shapes.append((IPA_TO_SHAPE[phone], _get_phoneme_weight(phone)))
            continue

        # Try without length marker
        if clean in IPA_TO_SHAPE:
            weight = _get_phoneme_weight(clean)
            if "ː" in phone:
                weight *= 1.3  # long vowels are longer
            shapes.append((IPA_TO_SHAPE[clean], weight))
            continue

        # Try first character (for unrecognized combinations)
        if clean and clean[0] in IPA_TO_SHAPE:
            shapes.append((IPA_TO_SHAPE[clean[0]], _get_phoneme_weight(clean[0])))
            continue

        # Unknown phoneme — skip (don't add noise)

    return shapes


def _phonemize_text(text: str) -> str:
    """Run phonemizer on text to get IPA phonemes using pre-initialized backend."""
    try:
        results = _espeak_backend.phonemize(
            [text], _espeak_separator, True
        )
        return results[0] if results else ""
    except Exception as e:
        print(f"Lip Sync [phonemize error]: {e}")
        return ""


# ============================================================
# Character-based fallback (original approach)
# ============================================================

# Multi-character patterns (checked first, in order of length)
DIGRAPH_TO_SHAPE = {
    "ght": "B", "kn": "B", "wr": "H", "mb": "A", "mn": "A",
    "th": "B", "sh": "B", "ch": "B", "wh": "F", "ph": "G",
    "ng": "B", "ck": "B",
    "oo": "F", "ee": "C", "ea": "C", "ai": "C", "ay": "C",
    "ey": "C", "ie": "C", "oa": "E", "ow": "E", "ou": "D",
    "au": "E", "aw": "E", "oi": "E", "oy": "E", "ue": "F", "ew": "F",
    "tion": "B", "sion": "B", "ing": "B", "ed": "B",
}

CHAR_TO_SHAPE = {
    "m": "A", "b": "A", "p": "A",
    "k": "B", "s": "B", "t": "B", "d": "B", "n": "B",
    "g": "B", "z": "B", "c": "B", "j": "B", "q": "B",
    "x": "B", "h": "B",
    "e": "C", "i": "C", "y": "C",
    "a": "D",
    "o": "E",
    "u": "F", "w": "F",
    "f": "G", "v": "G",
    "l": "H", "r": "H",
}

PAUSE_CHARS = {
    ".": 0.8, ",": 0.4, "!": 0.8, "?": 0.8,
    ";": 0.5, ":": 0.5, "-": 0.3, "\u2014": 0.4,
}


def _text_to_phonemes_fallback(text: str) -> List[tuple]:
    """Character-based fallback when phonemizer is unavailable."""
    text = text.lower()
    phonemes = []
    i = 0

    while i < len(text):
        matched = False
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
        if char in PAUSE_CHARS:
            phonemes.append(("X", PAUSE_CHARS[char]))
        elif char == " ":
            phonemes.append(("X", 0.3))
        elif char in CHAR_TO_SHAPE:
            weight = 1.2 if char in "aeiou" else 1.0
            phonemes.append((CHAR_TO_SHAPE[char], weight))
        i += 1

    return phonemes


# ============================================================
# Public API
# ============================================================

def get_wav_duration(wav_path: str) -> float:
    """Get duration of a WAV file. Returns seconds."""
    try:
        with wave.open(wav_path, 'rb') as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            if rate > 0:
                return frames / float(rate)
    except Exception as e:
        print(f"Lip Sync [WAV Duration ERROR] {e}")
    return 0.0


def generate_lip_sync_from_text(
    text: str,
    audio_duration: float,
) -> Optional[List[Dict[str, Any]]]:
    """
    Generate lip sync data from text.

    Uses IPA phoneme analysis via espeak-ng when available,
    falls back to character-based estimation otherwise.

    Args:
        text: The spoken text
        audio_duration: Duration of the audio in seconds

    Returns:
        List of mouth cues with timing and VRM blend shape values.
    """
    if not text or audio_duration <= 0:
        return None

    gen_start = time.perf_counter()

    # Choose engine: IPA-based or character-based fallback
    if _HAS_PHONEMIZER:
        ipa = _phonemize_text(text)
        if ipa:
            shapes = _ipa_to_shapes(ipa)
            engine_name = "IPA"
        else:
            shapes = _text_to_phonemes_fallback(text)
            engine_name = "Fallback"
    else:
        shapes = _text_to_phonemes_fallback(text)
        engine_name = "Text-Based"

    if not shapes:
        return None

    # Merge consecutive identical shapes
    merged = []
    for shape, weight in shapes:
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
    print(f"Lip Sync [{engine_name}] {gen_ms:.1f}ms ({len(lip_sync_data)} cues, {audio_duration:.1f}s audio)")
    return lip_sync_data
