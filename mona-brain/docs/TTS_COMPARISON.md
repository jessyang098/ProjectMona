# TTS Voice Cloning Options Analysis

This document outlines the text-to-speech (TTS) options evaluated for Mona's voice synthesis, focusing on **custom anime voice cloning** with low latency.

## Requirements

1. **Custom Voice Cloning** - Must support cloning a specific anime-style voice
2. **Low Latency** - Fast time-to-first-audio for responsive conversations
3. **Cost Effective** - Sustainable for both free and paid tiers
4. **Quality** - Natural-sounding speech with good pronunciation

## Options Evaluated

### Self-Hosted (RunPod)

| Model | Parameters | Voice Cloning Method | Streaming | Cold Start |
|-------|------------|---------------------|-----------|------------|
| GPT-SoVITS v2 | ~300M | Fine-tune (1 min audio) | No | 20-60s |
| CosyVoice 2 | 0.5B | Zero-shot (audio sample) | Yes | 20-60s |
| Fish Speech 1.5 | ~500M | Zero-shot (10-30s audio) | Yes | 20-60s |

### API Services (No Hosting)

| Service | Voice Cloning | Streaming | Cold Start |
|---------|---------------|-----------|------------|
| Fish Audio API | Zero-shot | Yes | None |
| ElevenLabs | Zero-shot (1 min audio) | Yes | None |
| Cartesia | No cloning | Yes | None |
| OpenAI TTS | No cloning | No | None |

**Note:** Cartesia and OpenAI TTS were excluded from final consideration as they don't support custom voice cloning.

## Benchmark Comparisons

### Inference Speed (RTF = Real-Time Factor)

| Model | RTF (RTX 4090) | RTF (RTX 4060) | Speed vs Realtime |
|-------|----------------|----------------|-------------------|
| GPT-SoVITS v2 | 0.014 | 0.028 | 36-71x faster |
| Fish Speech 1.5 | ~0.067 (1:15) | ~0.20 (1:5) | 5-15x faster |
| CosyVoice 2 | N/A | N/A | Streaming optimized |

*Lower RTF = faster. RTF 0.014 means 1 second of audio generates in 0.014 seconds.*

### First-Byte Latency (Time to First Audio)

| Model | First-Byte Latency | Notes |
|-------|-------------------|-------|
| **ElevenLabs** | ~75ms | Fastest, API only |
| **CosyVoice 2** | ~150ms | Streaming architecture |
| **Fish Speech 1.5** | ~150ms | Streaming architecture |
| **Fish Audio API** | ~150ms | Hosted Fish Speech |
| **GPT-SoVITS v2** | ~500ms-1s+ | No streaming support |

### Voice Quality Metrics

| Model | MOS Score | ELO (TTS Arena) | Voice Similarity |
|-------|-----------|-----------------|------------------|
| Fish Speech 1.5 | - | 1339 (highest) | 0.914 Resemblyzer |
| CosyVoice 2 | 5.53 | - | Excellent |
| GPT-SoVITS v2 | ~5.0 | - | Good (fine-tuned) |
| ElevenLabs | - | - | Excellent |

### Cost Analysis

| Option | Cost Model | Est. Cost per Response* |
|--------|------------|------------------------|
| GPT-SoVITS (RunPod) | ~$0.25/hr GPU | ~$0.001 |
| CosyVoice 2 (RunPod) | ~$0.25/hr GPU | ~$0.001 |
| Fish Speech (RunPod) | ~$0.25/hr GPU | ~$0.001 |
| Fish Audio API | $0.015/1K chars | ~$0.003 |
| ElevenLabs | $0.30/1K chars | ~$0.06 |

*Assuming ~200 characters per response*

## Key Findings

### Why GPT-SoVITS Feels Slower

GPT-SoVITS has excellent inference speed (RTF 0.014-0.028) but lacks **streaming support**. This means:
- User must wait for entire audio to generate before playback starts
- Network round-trip to RunPod adds additional latency
- Perceived latency is 500ms-1s+ even though inference is fast

### Streaming Architecture Advantage

CosyVoice 2 and Fish Speech use streaming architectures:
- Audio starts playing within 150ms
- Rest of audio generates while user listens
- Feels significantly more responsive

### Cold Start Problem

All self-hosted options on RunPod serverless have cold start issues:
- First request after idle: 20-60 seconds delay
- Subsequent requests: Normal latency
- Mitigation: Keep-warm pings or reserved instances (higher cost)

## Recommendations

### Free Tier
**Current:** GPT-SoVITS on RunPod
- Already set up with fine-tuned custom voice
- Acceptable latency for free tier users
- No per-request costs

**Future Upgrade:** CosyVoice 2 or Fish Speech on RunPod
- 3-6x better perceived latency (streaming)
- Zero-shot cloning = easier voice updates
- Same hosting cost

### Paid Tier
**Recommended:** Fish Audio API
- 150ms first-byte latency
- No cold start issues
- $0.015/1K chars (~$0.003/response)
- Zero-shot voice cloning
- No infrastructure management

**Premium Option:** ElevenLabs
- 75ms first-byte latency (fastest)
- Best voice quality
- $0.30/1K chars (~$0.06/response) - 20x more expensive
- Best for users who prioritize quality over cost

## Implementation Status

| Component | Status | File |
|-----------|--------|------|
| GPT-SoVITS integration | ✅ Complete | `tts_sovits.py` |
| OpenAI TTS fallback | ✅ Complete | `tts.py` |
| Fish Audio API | ❌ Not implemented | - |
| CosyVoice 2 | ❌ Not implemented | - |
| Fish Speech (self-hosted) | ❌ Not implemented | - |

## References

- [GPT-SoVITS GitHub](https://github.com/RVC-Boss/GPT-SoVITS)
- [GPT-SoVITS Benchmark #2579](https://github.com/RVC-Boss/GPT-SoVITS/issues/2579)
- [CosyVoice GitHub](https://github.com/FunAudioLLM/CosyVoice)
- [Fish Speech GitHub](https://github.com/fishaudio/fish-speech)
- [Fish Audio API](https://fish.audio/)
- [ElevenLabs](https://elevenlabs.io/)
- [Best Voice Cloning Models 2025](https://www.siliconflow.com/articles/en/best-voice-cloning-models-for-edge-deployment)

---

*Last updated: January 2026*
