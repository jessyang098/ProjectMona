"""
TTS Text Preprocessor for Mona

Cleans and prepares LLM output text for text-to-speech synthesis.
Removes markdown formatting, code blocks, special characters, and other
elements that would sound awkward when spoken aloud.
"""

import re
from typing import List, Optional


def clean_for_tts(text: str) -> str:
    """
    Clean LLM output text for TTS synthesis.

    Removes/converts:
    - Markdown formatting (bold, italic, headers, links, etc.)
    - Code blocks and inline code
    - Emojis and special unicode characters
    - Action markers like *waves* or (sighs)
    - URLs and file paths
    - Excessive punctuation
    - Smart quotes to regular quotes

    Args:
        text: Raw LLM output text

    Returns:
        Cleaned text suitable for TTS
    """
    if not text:
        return ""

    # 1. Remove code blocks (```code```)
    text = re.sub(r'```[\s\S]*?```', '', text)

    # 2. Remove inline code (`code`)
    text = re.sub(r'`[^`]+`', '', text)

    # 3. Remove markdown headers (# ## ### etc)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)

    # 4. Remove markdown bold (**text** or __text__) - preserve the text
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)  # **bold**
    text = re.sub(r'__([^_]+)__', r'\1', text)       # __bold__

    # 5. Remove action markers *action* - common in roleplay
    # Action markers typically contain spaces: *waves excitedly* *sighs deeply*
    # Single-word *italic* should be preserved as text
    text = re.sub(r'\*([^*]*\s[^*]*)\*', '', text)  # *action with spaces* -> remove entirely
    text = re.sub(r'\*([^*]+)\*', r'\1', text)       # *single_word* -> keep as italic text
    text = re.sub(r'(?<!_)_([^_\s][^_]*)_(?!_)', r'\1', text)  # _italic_ (not __)

    # 5. Remove markdown images ![alt](url) - MUST be before link removal
    text = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', text)
    text = re.sub(r'!\[[^\]]*\]', '', text)  # Also catch ![alt] without url

    # 6. Remove markdown links [text](url) -> keep text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)

    # 7. Remove bullet points and list markers
    text = re.sub(r'^[\s]*[-*+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^[\s]*\d+\.\s+', '', text, flags=re.MULTILINE)

    # 8. Remove URLs
    text = re.sub(r'https?://[^\s]+', '', text)
    text = re.sub(r'www\.[^\s]+', '', text)

    # 9. Remove file paths (common patterns)
    text = re.sub(r'[/\\][\w./\\-]+\.\w+', '', text)

    # 10. Remove parenthetical actions (action) - common in roleplay
    text = re.sub(r'\([^)]*\)', '', text)   # (sighs)

    # 11. Replace smart quotes with regular quotes
    text = text.replace('\u2018', "'")  # '
    text = text.replace('\u2019', "'")  # '
    text = text.replace('\u201c', '"')  # "
    text = text.replace('\u201d', '"')  # "

    # 12. Replace em-dash and en-dash with regular dash
    text = text.replace('\u2014', '-')  # —
    text = text.replace('\u2013', '-')  # –

    # 13. Replace ellipsis character with periods
    text = text.replace('\u2026', '...')  # …

    # 14. Remove common emojis (basic range)
    # This removes most common emojis while preserving Japanese characters
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags
        "\U00002702-\U000027B0"  # dingbats
        "\U000024C2-\U0001F251"  # enclosed characters
        "]+",
        flags=re.UNICODE
    )
    text = emoji_pattern.sub('', text)

    # 15. Replace hyphens with spaces (optional - helps some TTS)
    # text = text.replace('-', ' ')

    # 16. Remove excessive punctuation (more than 3 of same)
    text = re.sub(r'([!?.]){4,}', r'\1\1\1', text)

    # 17. Remove hashtags
    text = re.sub(r'#\w+', '', text)

    # 18. Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()

    return text


def clean_for_tts_japanese(text: str) -> str:
    """
    Clean text for Japanese TTS synthesis.
    Similar to clean_for_tts but preserves Japanese characters
    and handles Japanese-specific patterns.

    Args:
        text: Raw text (may contain Japanese)

    Returns:
        Cleaned text suitable for Japanese TTS
    """
    # Start with base cleaning
    text = clean_for_tts(text)

    # Japanese-specific: convert full-width to half-width for some chars
    # (numbers and basic punctuation)
    fw_to_hw = str.maketrans(
        '０１２３４５６７８９',
        '0123456789'
    )
    text = text.translate(fw_to_hw)

    return text


def split_for_tts(text: str, max_length: int = 200) -> List[str]:
    """
    Split long text into chunks suitable for TTS.
    Splits on sentence boundaries when possible.

    Args:
        text: Text to split
        max_length: Maximum characters per chunk

    Returns:
        List of text chunks
    """
    if len(text) <= max_length:
        return [text] if text else []

    # Split on sentence boundaries
    sentences = re.split(r'(?<=[.!?])\s+', text)

    chunks = []
    current_chunk = ""

    for sentence in sentences:
        if len(current_chunk) + len(sentence) + 1 <= max_length:
            if current_chunk:
                current_chunk += " " + sentence
            else:
                current_chunk = sentence
        else:
            if current_chunk:
                chunks.append(current_chunk)

            # If single sentence is too long, split by commas
            if len(sentence) > max_length:
                parts = sentence.split(', ')
                current_chunk = ""
                for part in parts:
                    if len(current_chunk) + len(part) + 2 <= max_length:
                        if current_chunk:
                            current_chunk += ", " + part
                        else:
                            current_chunk = part
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                        current_chunk = part
            else:
                current_chunk = sentence

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


# Convenience function matching Riko's API
def clean_llm_output(text: str) -> str:
    """
    Clean LLM output for TTS (Riko-compatible API).

    Args:
        text: Raw LLM output

    Returns:
        Cleaned text for TTS
    """
    return clean_for_tts(text)


if __name__ == "__main__":
    # Test examples
    test_cases = [
        "Hello! **How are you?** I'm doing *great*!",
        "Check out this code: `print('hello')` and this ```python\nprint('world')\n```",
        "Here's a link: [click me](https://example.com) and an image ![alt](img.png)",
        "I'm feeling happy 😊 and excited 🎉 today!",
        "*waves enthusiastically* Hi there! (giggles)",
        "Let me explain:\n- First point\n- Second point\n1. Numbered\n2. List",
        "The file is at /path/to/file.txt or C:\\Users\\test.py",
        "What?!?!?!?! That's amazing!!!!!!",
    ]

    print("TTS Preprocessing Tests:\n")
    for test in test_cases:
        print(f"Input:  {test}")
        print(f"Output: {clean_for_tts(test)}")
        print()
