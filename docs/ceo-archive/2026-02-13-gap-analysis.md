# Competitive Gap Analysis & Pre-Launch Sprint Plan (2026-02-13)

## Context
Competitive analysis against Riko (desktop AI companion) identified 7 gaps. This analysis prioritizes them against our launch goals, verifies claims against actual code state, and defines sprint order.

## Critical Finding: Sentence-Level TTS Pipelining is NOT Working

Despite being listed as a feature, code review confirms:
- `split_into_sentences()` exists in `main.py:270` but is **never called**
- Lines 686-697: TTS runs on `mona_content` (full response) ONLY after LLM completes
- The LLM streams chunks to frontend (for text display), but TTS waits for the complete event
- **This is the single biggest latency bottleneck in the entire product**

Current voice-to-voice flow:
```
User speaks → STT (1-2s) → LLM streams (1-3s) → TTS on FULL response (1-3s) → Audio plays
Total: 4-8 seconds of silence after user stops speaking
```

With sentence-level TTS pipelining:
```
User speaks → STT (1-2s) → LLM starts streaming → Sentence 1 complete → TTS sentence 1 (0.5s) → Audio plays
                                                  → Sentence 2 complete → TTS sentence 2 (queued)
Total: 2-4 seconds to first audio (LLM first sentence + TTS for that sentence)
```

Savings: 2-4 seconds off perceived latency. This is transformative for voice UX.

## Gap-by-Gap Analysis

### 1. Sentence-Level TTS Pipelining — PRIORITY 1
- **Status**: NOT implemented (code exists but unused)
- **Impact**: Saves 2-4s on voice-to-first-audio. Biggest single UX improvement possible.
- **Effort**: 4 hours
- **How**: Accumulate LLM chunks, detect sentence boundaries, fire off TTS per sentence via `asyncio.create_task()`, send `audio_segment` WebSocket messages as each completes. Frontend already handles `audio_segment` messages from existing pipelining infrastructure.
- **Risk**: Sentence splitting edge cases (abbreviations, ellipsis). Mitigate with conservative splitter.
- **Verdict**: BUILD FIRST. This is the single most impactful change before launch.

### 2. DB Writes Off Critical Path — PRIORITY 2
- **Status**: 3 sequential DB writes block LLM start (lines 587-627)
  - Guest message count increment + commit (lines 604-610)
  - Analytics tracking (lines 613-617, already non-blocking)
  - User last_message_at update + commit (lines 620-626)
  - User message save to DB + commit (lines 639-647)
- **Impact**: ~100-200ms saved per message. Free latency reduction.
- **Effort**: 1 hour
- **How**: Wrap non-critical writes in `asyncio.create_task()`. Guest limit CHECK must remain on critical path, but the INCREMENT can be async. User message save can happen after LLM starts.
- **Risk**: Near zero. Worst case: a count is off by one on crash.
- **Verdict**: BUILD. Trivial effort, real impact, zero risk.

### 3. Groq Whisper STT — PRIORITY 3 (CONDITIONAL)
- **Current**: OpenAI Whisper-1, 1-2s, $0.36/hr
- **Groq**: Whisper Large v3 Turbo, ~100-200ms, $0.04/hr
- **Impact**: 0.8-1.5s saved on STT step. 9x cost reduction.
- **The question**: Is voice-to-voice the primary use case at launch?
- **Reality check**: Most early users will text chat. Voice is a differentiator but not the primary interaction mode for the first 50 users. The STT cost difference is negligible at low volume ($0.36/hr vs $0.04/hr — at 10 users doing 5 min voice/day, this is cents).
- **Verdict**: BUILD if time permits, but AFTER items 1-2 and PostHog. The latency gain is real but less impactful than TTS pipelining. The cost savings are irrelevant at launch scale. If sprint is tight, defer to week 1 post-launch.

### 4. PostHog Analytics — PRIORITY 3 (TIED WITH GROQ)
- **Status**: Analytics module exists but PostHog not connected
- **Impact**: Can't measure retention, funnels, or engagement without this. Flying blind.
- **Effort**: 4 hours
- **Why priority 3 not 1**: You need users before analytics matters. You can manually check SQLite for the first 50 users. But you need PostHog before you can measure D7 retention, which means it needs to be live within the first week.
- **Verdict**: BUILD before first Reddit post. Not before TTS pipelining.

### 5. Sentry Error Monitoring — PRIORITY 4
- **Impact**: Know when things break in production instead of discovering via user complaints
- **Effort**: 2 hours (pip install sentry-sdk, add DSN, wrap FastAPI + Next.js)
- **Verdict**: BUILD. Quick win. Critical for production stability. But after the latency work.

### 6. Animation Blending (crossFadeTo) — PRIORITY 5
- **Impact**: Smoother visual transitions. Polish, not functionality.
- **Effort**: 2 hours
- **Verdict**: BUILD if time remains. Nice polish but won't make or break first impressions. Users notice conversation quality and voice quality before animation smoothness.

### 7. Typing Simulation — PRIORITY 6 (RECONSIDER)
- **Current**: We already stream LLM chunks to the frontend as `message_chunk` events
- **Impact**: Chunks already create a progressive text reveal effect. Adding per-character animation on top of streaming is marginal.
- **Real question**: Does the current chunk streaming look good enough? If chunks arrive word-by-word from GPT-4o streaming, that IS typing simulation.
- **Verdict**: VERIFY current UX first. If chunk streaming already looks like typing, skip this entirely. If chunks arrive in large blocks, add a small character-by-character buffer. Low priority either way.

## Sprint Order

| Order | Task | Effort | Cumulative | Why This Order |
|-------|------|--------|------------|----------------|
| 1 | Sentence-level TTS pipelining | 4h | 4h | Biggest UX improvement, most complex, do while fresh |
| 2 | DB writes off critical path | 1h | 5h | Quick win, stacks with #1 for total latency reduction |
| 3 | PostHog analytics | 4h | 9h | Must be live before first users arrive |
| 4 | Sentry error monitoring | 2h | 11h | Must have for production |
| 5 | Groq Whisper STT | 2h | 13h | Latency + cost improvement for voice users |
| 6 | crossFadeTo blending | 2h | 15h | Polish |
| 7 | Typing simulation | 0-2h | 15-17h | Verify if needed first |
| **Total** | | **15-17h** | | |

## What I'd Cut If Sprint Is Tight (Under 12 Hours)

Keep: Items 1-4 (11 hours). These are non-negotiable for launch.
Defer: Items 5-7 to week 1 post-launch. Groq can wait — text chat users won't notice. Animation and typing are polish.

## Missing Gaps Not in Your List

### Gap 8: No Loading/Connection State for Voice
When user stops recording, there's no visual feedback during the STT → LLM → TTS pipeline. User sees nothing for 4-8 seconds. Should show:
- "Listening..." during STT
- Typing indicator during LLM (already exists)
- "Speaking..." or waveform during TTS generation
**Effort**: 2 hours. **Priority**: Medium. Add to post-launch polish.

### Gap 9: No Conversation Warmup / Cold Start
First message from a new user gets the full cold LLM latency. No pre-warming of the conversation context. Consider pre-loading system prompt on WebSocket connect (before first message).
**Effort**: 1 hour. **Priority**: Low — already loading personality on startup.

### Gap 10: Audio Playback Queue
If sentence-level TTS pipelining is implemented, frontend needs a proper audio queue to play segments sequentially without gaps or overlaps. Verify the existing `audio_segment` handling does this correctly.
**Effort**: Included in TTS pipelining estimate. **Priority**: Part of item 1.

## Key Insight

The competitive gap that matters most is NOT feature parity with Riko. It's **perceived responsiveness**. A companion that responds in 2 seconds feels alive. One that takes 6 seconds feels like software. Everything in this sprint should serve that single goal: make Mona feel responsive and present.

The features we already have OVER Riko (memory, affection, auth, multi-user, web access) are more strategically important than animation smoothness. Our moat is emotional depth. The sprint should focus on making the DELIVERY of that depth feel instant.
