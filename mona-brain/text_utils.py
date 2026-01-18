"""
Text preprocessing utilities for Mona's speech
Handles phoneme filtering and text cleanup for better TTS quality
"""

import re
from typing import List, Tuple


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

    # Replace problematic expressions for TTS
    # Words containing "tch" (watch, catch, etc.) are fine - TTS handles them
    replacements = {
        r'\btch\b': 'tsk',
        r'\baww+\b': 'awe',  # "aww", "awww" -> "awe" for speech (TTS struggles with double-w)
    }

    # Apply replacements (case-insensitive)
    cleaned = text
    for pattern, replacement in replacements.items():
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)

    return cleaned


def split_into_sentences(text: str) -> List[str]:
    """
    Split text into sentences for pipelined TTS generation.

    Args:
        text: Full text to split

    Returns:
        List of sentence strings
    """
    if not text:
        return []

    # Split on sentence-ending punctuation followed by space or end of string
    # Keep the punctuation with each sentence
    pattern = r'(?<=[.!?])\s+'
    sentences = re.split(pattern, text.strip())

    # Filter out empty strings and very short fragments
    sentences = [s.strip() for s in sentences if s.strip() and len(s.strip()) > 1]

    return sentences


def extract_complete_sentences(text: str) -> Tuple[List[str], str]:
    """
    Extract complete sentences from streaming text, returning remaining incomplete text.

    Args:
        text: Accumulated streaming text

    Returns:
        Tuple of (list of complete sentences, remaining incomplete text)
    """
    if not text:
        return [], ""

    # Find the last sentence-ending punctuation
    last_end = -1
    for i, char in enumerate(text):
        if char in '.!?':
            # Check if this is likely end of sentence (not abbreviation like "Mr." or "e.g.")
            # Simple heuristic: followed by space and capital letter, or end of string
            if i == len(text) - 1:
                last_end = i
            elif i < len(text) - 1 and text[i + 1] == ' ':
                last_end = i

    if last_end == -1:
        # No complete sentences yet
        return [], text

    complete_part = text[:last_end + 1]
    remaining = text[last_end + 1:].strip()

    sentences = split_into_sentences(complete_part)
    return sentences, remaining


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
