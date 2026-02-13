# Pre-Launch Polish Sprint (2026-02-13)

## Context
Competitive analysis against Riko project revealed animation improvements (ported). Broader analysis revealed latency, analytics, and pipeline gaps that matter more than feature additions.

## Key Decisions

### STT: Switch to Groq Whisper
- **Current**: OpenAI Whisper-1 API, 1-2s latency per transcription
- **Switch to**: Groq Whisper Large v3 Turbo, ~100-200ms including network
- **Pricing**: $0.04/hr (cheaper than OpenAI's $0.36/hr)
- **Effort**: 2 hours. Change `/transcribe` endpoint to call Groq API. Keep OpenAI as fallback.
- **Why**: Voice loop latency is the #1 UX differentiator. 1-2s -> 100-200ms is transformative.

### Pipeline Optimizations
1. **DB writes off critical path**: Guest count, analytics, user timestamp updates should be `asyncio.create_task()` not awaited before LLM starts. ~50-100ms saved.
2. **Sentence-level TTS from LLM stream**: Currently TTS waits for full LLM response. Should kick off TTS per-sentence as LLM streams. Infrastructure already exists (audio_segment WebSocket messages). 4 hours effort.
3. **Target**: Voice-to-voice under 2 seconds (currently estimated 4-7s).

### Animation Improvements
- crossFadeTo() instead of fadeIn/fadeOut for smoother blending (2 hours)
- Idle variation needed (multiple idle animations, weight shifts, look-arounds)
- Gesture randomization per emotion (currently deterministic, should be 2-3 options per emotion)

### Not Building Yet
- Image generation/selfies (3-month roadmap item)
- Streaks/currency (need users first)
- Cosmetic catalog (need users first)
- More personality archetypes (2 is enough for launch)

## Pre-Launch Sprint Priorities

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Groq Whisper STT | 2h | Voice UX transformed |
| 2 | PostHog analytics | 4h | Can measure everything |
| 3 | DB writes off critical path | 1h | 50-100ms saved |
| 4 | Sentence-level TTS pipelining | 4h | Audio starts while LLM generates |
| 5 | crossFadeTo() blending | 2h | Smoother animations |
| 6 | Typing simulation (frontend) | 2h | Chat feels human |
| 7 | Sentry error monitoring | 2h | Know when things break |
| **Total** | | **~17h** | |
