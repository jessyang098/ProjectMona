#!/usr/bin/env python3
"""
Pre-cache common Mona phrases for instant voice responses
"""
import asyncio
from pathlib import Path
from tts_sovits import MonaTTSSoVITS

# Common phrases Mona says frequently
COMMON_PHRASES = [
    # Greetings
    "Hi! I'm Mona! I'm so happy to meet you! 💖",
    "Hello! It's so nice to see you! How's your day going?",
    "Hey there! I've been waiting for you!",

    # Acknowledgments
    "That's interesting! Tell me more about that.",
    "I see! That makes sense.",
    "Oh, I understand!",
    "That's really cool!",

    # Questions
    "How are you feeling today?",
    "What would you like to talk about?",
    "Tell me more!",

    # Reactions
    "Hehe, you're funny! 😊",
    "That sounds really nice!",
    "I appreciate you talking with me.",

    # Goodbyes
    "Goodbye! I'll miss you! Come back soon, okay? 💕",
    "See you later! Take care!",
    "Talk to you soon!",
]


async def precache_all_phrases():
    """Generate and cache all common phrases"""
    print("🎤 Starting voice pre-caching for Mona...")
    print(f"📝 {len(COMMON_PHRASES)} phrases to generate\n")

    # Initialize TTS (will use local server if running, otherwise skip)
    try:
        tts = MonaTTSSoVITS(
            sovits_url="http://127.0.0.1:9880/tts",  # Use local server
            ref_audio_path="/Users/vevocube/Desktop/ProjectMona/mona-brain/assets/mona_voice/main_sample.wav",
        )
    except Exception as e:
        print(f"❌ Could not initialize TTS: {e}")
        print("Make sure GPT-SoVITS server is running on port 9880")
        return

    success_count = 0
    failed = []

    for i, phrase in enumerate(COMMON_PHRASES, 1):
        print(f"[{i}/{len(COMMON_PHRASES)}] Generating: {phrase[:50]}...")

        try:
            audio_path = await tts.generate_speech(phrase, use_cache=False)
            if audio_path:
                print(f"  ✓ Cached to: {Path(audio_path).name}")
                success_count += 1
            else:
                print(f"  ✗ Failed (no audio returned)")
                failed.append(phrase)
        except Exception as e:
            print(f"  ✗ Failed: {e}")
            failed.append(phrase)

        # Small delay to avoid overwhelming the server
        await asyncio.sleep(0.5)

    print("\n" + "="*60)
    print(f"✅ Pre-caching complete!")
    print(f"   Success: {success_count}/{len(COMMON_PHRASES)}")

    if failed:
        print(f"   Failed: {len(failed)}")
        print("\nFailed phrases:")
        for phrase in failed:
            print(f"   - {phrase[:50]}...")

    # Show cache stats
    cache_size_mb = tts.get_cache_size() / (1024 * 1024)
    print(f"\n📦 Total cache size: {cache_size_mb:.2f} MB")
    print(f"📁 Cache location: {tts.audio_dir}")


if __name__ == "__main__":
    asyncio.run(precache_all_phrases())
