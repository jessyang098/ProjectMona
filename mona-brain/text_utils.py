"""
Text preprocessing utilities for Mona's speech
Handles phoneme filtering and text cleanup for better TTS quality
"""

import re


def preprocess_tts_text(text: str) -> str:
    """
    Preprocess text before sending to TTS to avoid problematic phonemes.

    Args:
        text: Raw text from LLM

    Returns:
        Cleaned text suitable for TTS
    """
    if not text:
        return text

    # Replace "tch" sound with alternatives
    # "watch" -> "wah" (phonetic approximation)
    # "catch" -> "cah"
    # "match" -> "mah"
    replacements = {
        # Common "tch" words
        r'\bwatch\b': 'wah',
        r'\bwatching\b': 'wahing',
        r'\bwatched\b': 'wahed',
        r'\bcatch\b': 'cah',
        r'\bcatching\b': 'cahing',
        r'\bcaught\b': 'cawt',
        r'\bmatch\b': 'mah',
        r'\bmatching\b': 'mahing',
        r'\bmatched\b': 'mahed',
        r'\bpatch\b': 'pah',
        r'\bscrat(ch|ching)\b': 'scrahing',
        r'\bstret(ch|ching)\b': 'strehing',
        r'\bswit(ch|ching)\b': 'swihing',
        r'\bkit(chen)\b': 'kihen',
        r'\bpit(ch|ching)\b': 'pihing',
        r'\bdit(ch)\b': 'dih',
        r'\btwit(ch)\b': 'twih',
        r'\bglitch\b': 'glih',
        r'\bhatch\b': 'hah',
        r'\blatch\b': 'lah',
        r'\bbatch\b': 'bah',
    }

    # Apply replacements (case-insensitive)
    cleaned = text
    for pattern, replacement in replacements.items():
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)

    return cleaned


def clean_llm_output(text: str) -> str:
    """
    Clean up LLM output artifacts like markdown, asterisks, etc.

    Args:
        text: Raw LLM output

    Returns:
        Clean text suitable for display and TTS
    """
    if not text:
        return text

    # Remove markdown formatting
    cleaned = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # **bold**
    cleaned = re.sub(r'\*(.+?)\*', r'\1', cleaned)    # *italic*
    cleaned = re.sub(r'\_(.+?)\_', r'\1', cleaned)    # _italic_

    # Remove action indicators like *smiles*, *waves*, etc.
    cleaned = re.sub(r'\*[^*]+\*', '', cleaned)

    # Clean up excessive whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    return cleaned
