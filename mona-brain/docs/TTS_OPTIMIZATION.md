# TTS Optimization Plan

## Problem

Current pipeline latency is **5-6 seconds** from user message to audio playback:
 
```
LLM:  ~2s
TTS:  ~3s
────────
Total: ~5s
```

This feels slow for a conversational AI. Target should be **<3s** for snappy interactions.

## Current Architecture

```
User Message
    ↓
[LLM] Generate full response (~2s)
    ↓
[TTS] Generate full audio (~3s)
    ↓
[Send] Audio to client
    ↓
[Play] Audio starts
```

Everything is sequential. User waits for entire pipeline before hearing anything.

## TTS Engine Comparison

| Engine | Speed | Voice Quality | Cost | Notes |
|--------|-------|---------------|------|-------|
| GPT-SoVITS | ~3s | Good (custom voice) | Free (self-hosted) | Runs on RunPod GPU |
| Fish Audio | ~3s | Good | ~$0.01/request | Cloud API, network overhead |
| OpenAI TTS | ~1s | Generic voices only | ~$0.015/1K chars | No custom voice |

**Conclusion:** GPT-SoVITS is the right choice for custom voice. Need to optimize the pipeline, not switch engines.

## Key Concerns

### Audio Choppiness
Streaming audio in chunks can cause:
- Gaps between chunks if network/generation is slow
- Clicks/pops at chunk boundaries if not properly aligned
- Uneven pacing if chunks vary in length

**Mitigations:**
- Buffer 1-2 chunks ahead before playing
- Use proper audio frame boundaries (don't cut mid-sample)
- Crossfade between chunks
- Fall back to full audio if streaming fails

### Out-of-Order Sentences
With sentence-level pipelining:
- Sentence 2 might finish TTS before Sentence 1
- Network could deliver chunks out of order
- Race conditions in async code

**Mitigations:**
- Sequence numbers on each audio chunk
- Client-side queue that plays in order
- Wait for Sentence N before playing Sentence N+1
- Server-side ordering before sending

### Lip Sync Timing
With streaming:
- Can't know total audio duration upfront
- Lip sync cues need adjustment as more audio arrives
- Text-based estimation assumes final audio length

**Mitigations:**
- Send lip sync data with each chunk (relative timing)
- Or: Generate lip sync after full audio, send as update
- Or: Use real-time frequency analysis on client (current fallback)

---

## Ideas

### 1. Streaming TTS (High Impact)

**Current:** Wait for full audio → send to client → play
**Proposed:** Stream audio chunks as they're generated → play immediately

GPT-SoVITS already supports streaming (`streaming_mode: 1`). We receive chunks but wait for all of them before sending.

**Implementation:**
- Receive first audio chunk
- Send to client immediately via WebSocket
- Client starts playing while more chunks arrive
- Reduces perceived latency by ~1-2s

**Complexity:** Medium
**Expected gain:** 1-2s perceived latency reduction

### 2. Sentence-Level Pipelining (High Impact)

**Current:** LLM finishes → TTS starts
**Proposed:** TTS starts on first sentence while LLM generates rest

```
LLM:  [Sentence 1][Sentence 2][Sentence 3]
TTS:       [Audio 1][Audio 2][Audio 3]
                ↓
         Play immediately
```

**Implementation:**
- Stream LLM response
- Detect sentence boundaries (., !, ?)
- Start TTS on first complete sentence
- Queue subsequent sentences
- Stitch audio or send as separate chunks

**Risks:**
- Out-of-order: Sentence 2 audio could finish before Sentence 1
- Choppiness: Gaps between sentence audio files
- Complexity: Need queue management, error handling

**Mitigations:**
- Strict ordering: Don't start Sentence N+1 TTS until N is done
- Or: Generate in parallel but play in order (queue on client)
- Silence padding between sentences for natural pacing

**Complexity:** High
**Expected gain:** 1.5-2s (LLM and TTS overlap)

### 3. Shorter Responses (Low Effort)

Prompt engineering to make Mona give concise replies:
- 1-2 sentences for casual chat
- Longer only when explaining something

Less text = less audio = faster TTS

**Complexity:** Low
**Expected gain:** 0.5-1s

### 4. Audio Quality Tradeoffs

Current settings:
- Sample rate: 32kHz
- Speed factor: 1.3x

Options:
- Lower sample rate (16kHz) - faster, lower quality
- Higher speed factor (1.5x) - faster speech, may sound unnatural
- Lower bitrate MP3 - smaller files, faster transfer

**Complexity:** Low
**Expected gain:** 0.2-0.5s

### 5. Precompute Common Responses

Cache TTS for:
- Greetings ("Hi!", "Hello!", "Hey there!")
- Common phrases ("I see", "That's interesting")
- Error messages

**Complexity:** Low
**Expected gain:** Instant for cached phrases

### 6. WebSocket Audio Streaming

Instead of:
1. Generate full audio file
2. Save to disk
3. Send URL to client
4. Client fetches file

Do:
1. Stream audio bytes directly over WebSocket
2. Client plays as bytes arrive

Eliminates file I/O and HTTP request overhead.

**Complexity:** Medium-High
**Expected gain:** 0.3-0.5s

## Current Bugs to Fix

### Lip Sync Not Working for SoVITS

Logs show `cues=0` for SoVITS but works for Fish Audio.

**Likely cause:** `get_wav_duration()` returning 0 for SoVITS WAV format.

**Debug:** Added logging to show WAV duration. Need to check logs.

## Recommended Priority

1. **Fix lip sync bug** - Quick win, already have debug logging
2. **Shorter responses** - Prompt tweak, instant improvement
3. **Streaming TTS** - Biggest perceived latency gain
4. **Sentence pipelining** - Complex but major gain
5. **Precompute cache** - Nice to have

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Total pipeline | 5-6s | <3s |
| Time to first audio | 5s | <2s |
| Lip sync cues | 0 (broken) | 50-150 |

## References

- GPT-SoVITS streaming: https://github.com/RVC-Boss/GPT-SoVITS
- WebSocket binary streaming: Use `websocket.send_bytes()`
