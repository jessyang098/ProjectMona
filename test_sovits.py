#!/usr/bin/env python3
"""
Test script to verify GPT-SoVITS is working with the backend
"""
import sys
import asyncio
from pathlib import Path

# Add mona-brain to path
sys.path.insert(0, str(Path(__file__).parent / "mona-brain"))

from tts_sovits import MonaTTSSoVITS


async def test_sovits():
    print("=" * 60)
    print("Testing GPT-SoVITS Integration")
    print("=" * 60)

    # Initialize with absolute path (same as backend does now)
    riko_sample = Path("mona-brain/assets/mona_voice/main_sample.wav")
    abs_audio_path = riko_sample.resolve()

    print(f"\n1. Voice sample path: {abs_audio_path}")
    print(f"   File exists: {abs_audio_path.exists()}")
    print(f"   File size: {abs_audio_path.stat().st_size / 1024:.1f} KB")

    print("\n2. Initializing MonaTTSSoVITS...")
    tts = MonaTTSSoVITS(
        ref_audio_path=str(abs_audio_path),
        prompt_text="This is a sample voice for you to get started with.",
        speed_factor=1.3,
    )
    print("   ✓ Initialized")

    print("\n3. Testing GPT-SoVITS server connection...")
    test_text = "Hello! This is a test of the anime voice system."

    print(f"   Generating speech for: '{test_text}'")
    audio_path = await tts.generate_speech(test_text, use_cache=False)

    if audio_path:
        print(f"   ✓ SUCCESS! Audio generated: {audio_path}")
        audio_size = Path(audio_path).stat().st_size
        print(f"   Audio file size: {audio_size} bytes")

        if audio_size < 1000:
            print(f"   ⚠ WARNING: Audio file is very small ({audio_size} bytes)")
            print(f"   This might indicate an error in generation")
        else:
            print(f"   ✓ Audio file size looks good")

        return True
    else:
        print(f"   ✗ FAILED! No audio generated")
        print(f"   This means GPT-SoVITS server is not responding properly")
        return False


if __name__ == "__main__":
    print("\nMake sure GPT-SoVITS server is running on http://127.0.0.1:9880\n")

    success = asyncio.run(test_sovits())

    print("\n" + "=" * 60)
    if success:
        print("✓ GPT-SoVITS integration is working!")
        print("The anime voice should work in Mona now.")
    else:
        print("✗ GPT-SoVITS integration failed")
        print("Check if the GPT-SoVITS server is running properly.")
    print("=" * 60)

    sys.exit(0 if success else 1)
