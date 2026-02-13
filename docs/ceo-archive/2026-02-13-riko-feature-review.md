# Riko Feature Review: Borrow, Skip, or Defer (2026-02-13)

## Context

Deep dive into Riko's codebase identified 12 specific features/techniques across animation polish, voice latency, and audio playback. This document evaluates each against ProjectMona's pre-launch sprint priorities.

**North star**: Get to launch. Perceived responsiveness > visual polish. Only borrow what moves the needle for first 50 users.

---

## Animation Polish Features (1-7)

### 1. crossFadeTo() Animation Blending

| Field | Value |
|-------|-------|
| **Borrow?** | Yes |
| **Priority** | P2 (nice to have) |
| **Effort** | 2h |
| **Rationale** | We already use `fadeIn`/`fadeOut` separately in gestureManager.ts (lines 145, 167). `crossFadeTo` combines both into one call with guaranteed weight interpolation — less chance of visual glitches during transitions. Real but marginal improvement. Not launch-blocking. |

**Current state**: `gestureManager.ts` does `currentAction.fadeOut(duration)` then `newAction.fadeIn(duration)`. This works but can briefly show both animations at mismatched weights.

**Verdict**: Do it post-launch, week 1. Two-hour polish task.

---

### 2. Root Motion Stripping

| Field | Value |
|-------|-------|
| **Borrow?** | No |
| **Priority** | P3 (skip) |
| **Effort** | 1h |
| **Rationale** | Our character is stationary. We don't play walking/locomotion animations. Root motion stripping solves a problem we don't have. If we add full-body locomotion later (walking to different scene positions), revisit then. |

**Verdict**: Skip entirely. Solving a non-existent problem.

---

### 3. Animation Clip Trimming

| Field | Value |
|-------|-------|
| **Borrow?** | Later |
| **Priority** | P3 (skip for now) |
| **Effort** | 1h |
| **Rationale** | Useful when you have a large animation library and need to crop start/end frames. We have ~10 animations total. Manual adjustment in Blender or the animation file itself is simpler at this scale. Becomes valuable when we have 50+ animations and want to reuse partial clips. |

**Verdict**: Defer until animation library grows significantly.

---

### 4. Fade-Out Position Compensation

| Field | Value |
|-------|-------|
| **Borrow?** | No |
| **Priority** | P3 (skip) |
| **Effort** | 2h |
| **Rationale** | Only needed when animations move the character's hips significantly (e.g., sitting, lying down, dancing). Our current animation set is mostly upper-body gestures and idle poses. No visible position jumps to compensate for. |

**Verdict**: Skip. Same reasoning as root motion — solves a problem we don't have with our current animation set.

---

### 5. Eye-Leads-Head Movement

| Field | Value |
|-------|-------|
| **Borrow?** | Already implemented |
| **Priority** | N/A |
| **Effort** | 0h |
| **Rationale** | We ALREADY have this. `avatarStateMachine.ts` lines 118-119: `eyeLeadTime: 0.10`, `eyeLeadAmount: 1.1`. Same values as Riko. Our implementation is arguably more sophisticated — it includes state-dependent behavior (thinking state has different eye movement patterns than idle). |

**Verdict**: No action needed. We're at parity or ahead.

---

### 6. Spectral Lip Sync

| Field | Value |
|-------|-------|
| **Borrow?** | No |
| **Priority** | P3 (skip) |
| **Effort** | 4h |
| **Rationale** | We already have JALI-based formant lip sync that maps to 5 phonemes (aa, ee, ih, oh, ou) with per-phoneme attack/release curves, jaw coupling, amplitude modulation, and silence detection. This is MORE sophisticated than Riko's spectral centroid approach, which is a coarser approximation. Riko uses spectral centroid + RMS to infer mouth shapes; we use actual formant analysis. Switching would be a downgrade. |

**Our advantage**: Our lip sync has per-phoneme smoothing with independent attack/release factors (e.g., `aa: { attackFactor: 0.55, releaseFactor: 0.14 }`), which is closer to how real mouths work. Riko's single smoothing factor (0.2) is simpler but less natural.

**Verdict**: Skip. Our implementation is superior. Don't downgrade.

---

### 7. Deterministic Listening Nods

| Field | Value |
|-------|-------|
| **Borrow?** | Later |
| **Priority** | P2 (nice to have) |
| **Effort** | 1.5h |
| **Rationale** | Good UX detail — character nodding while "listening" to user speak makes her feel present and engaged. Sine-wave interpolation is the right approach for smooth, non-jarring nods. Currently we don't have explicit listening-state behavior for the avatar. However, this only matters during voice input, which won't be the primary mode for early users. |

**Verdict**: Defer to post-launch. Build when voice chat usage crosses 20% of sessions.

---

## Voice Latency Features (8-12)

### 8. Groq Whisper STT

| Field | Value |
|-------|-------|
| **Borrow?** | Yes |
| **Priority** | P2 (nice to have) |
| **Effort** | 2h |
| **Rationale** | 200ms vs 1-2s STT. 9x cheaper ($0.04/hr vs $0.36/hr). Clear win on both latency and cost. BUT: most early users will text chat. Voice users will notice the improvement, but there won't be many of them in the first 50 users. Cost savings are negligible at low volume. |

**Already in sprint backlog**: Confirmed in decisions log as P2, after TTS pipelining and PostHog.

**Verdict**: Build if time remains after P0/P1 items. Week 1 post-launch at latest.

---

### 9. LLM Sentence Chunking for Streaming TTS

| Field | Value |
|-------|-------|
| **Borrow?** | YES — CRITICAL |
| **Priority** | P0 (must have) |
| **Effort** | 4h |
| **Rationale** | THIS IS THE SINGLE MOST IMPORTANT ITEM ON THIS LIST. Our `split_into_sentences()` and `extract_complete_sentences()` exist in `text_utils.py` but are NEVER CALLED during LLM streaming. TTS waits for the full response. This adds 2-4s to every voice interaction. Fixing this transforms voice UX from "software" to "alive." |

**What to build**: As LLM streams chunks, accumulate text. When a complete sentence is detected (via `extract_complete_sentences()`), immediately fire TTS for that sentence as an `asyncio.create_task()`. Send `audio_segment` WebSocket messages as each completes. Frontend already handles `audio_segment` messages with a sorted queue (verified in `useWebSocket.ts` lines 185-203).

**Riko's approach**: `stream_text_chunks(min_len=30, max_len=120)` — similar concept but with length bounds. Our sentence-based approach is better for natural speech because TTS sounds best at sentence boundaries, not arbitrary length cuts.

**Verdict**: Build FIRST. Already approved as P0 in sprint backlog. This is not "borrowing from Riko" — it's fixing our own broken pipeline.

---

### 10. PlaybackWorker Queue

| Field | Value |
|-------|-------|
| **Borrow?** | No (already have equivalent) |
| **Priority** | N/A |
| **Effort** | 0h |
| **Rationale** | We already have an audio segment queue on the frontend (`useWebSocket.ts` lines 190-203) that sorts segments by index and plays them sequentially. Our implementation is React-native (state-based) vs Riko's threaded approach, but the concept is identical. Verify it works correctly once TTS pipelining is active. |

**Verdict**: No new work. Verify existing queue works during TTS pipelining testing.

---

### 11. Persistent Audio Element

| Field | Value |
|-------|-------|
| **Borrow?** | Already implemented (mobile) |
| **Priority** | P2 for desktop |
| **Effort** | 1h |
| **Rationale** | We already reuse a pre-unlocked audio element on mobile (`useAudioContext.ts` creates `__monaUnlockedAudio`, `lipSyncManager.ts` line 210-230 reuses it). On desktop, we create `new Audio()` per playback (line 249). Reusing a single element on desktop would reduce GC pressure and marginally reduce latency. |

**Current state**: Mobile = persistent element (good). Desktop = new element per playback (adequate). VRM avatar (`Live2DAvatar.tsx` line 1103) also creates `new Audio()` per playback.

**Verdict**: Low-priority optimization. The latency difference is <50ms. Do it during a cleanup pass, not during sprint.

---

### 12. 4-Strategy Audio Unlock for Mobile

| Field | Value |
|-------|-------|
| **Borrow?** | Partially (verify coverage) |
| **Priority** | P1 (should have) |
| **Effort** | 1.5h |
| **Rationale** | We have strategy 1 (AudioContext resume) and a version of strategy 2 (silent MP3 play) in `useAudioContext.ts`. We DON'T have the muted play/pause fallback or the transient element fallback. Mobile audio autoplay restrictions vary by browser and OS version. If any user on iOS Safari or Android Chrome can't hear Mona's voice, that's a critical UX failure. More unlock strategies = more coverage. |

**Risk without this**: A user opens the app, taps to start chatting, Mona "speaks" but no audio plays. User thinks voice is broken. We lose them. This is a real risk on mobile browsers.

**Verdict**: Build before launch. Not as urgent as TTS pipelining, but mobile audio reliability is a launch requirement.

---

## Final Sprint Ordering

### Must Build Before Launch (P0)

| # | Task | Effort | Cumulative |
|---|------|--------|------------|
| 1 | Sentence-level TTS pipelining (#9) | 4h | 4h |
| 2 | DB writes off critical path | 1h | 5h |

### Should Build Before Launch (P1)

| # | Task | Effort | Cumulative |
|---|------|--------|------------|
| 3 | Mobile audio unlock hardening (#12) | 1.5h | 6.5h |
| 4 | PostHog analytics | 4h | 10.5h |
| 5 | Sentry error monitoring | 2h | 12.5h |

### Build Week 1 Post-Launch (P2)

| # | Task | Effort | Cumulative |
|---|------|--------|------------|
| 6 | Groq Whisper STT (#8) | 2h | 14.5h |
| 7 | crossFadeTo() blending (#1) | 2h | 16.5h |
| 8 | Listening nods (#7) | 1.5h | 18h |
| 9 | Desktop persistent audio element (#11) | 1h | 19h |

### Skip / Already Have

| # | Feature | Reason |
|---|---------|--------|
| 2 | Root motion stripping | No locomotion animations |
| 3 | Clip trimming | Too few animations to justify |
| 4 | Position compensation | No position-shifting animations |
| 5 | Eye-leads-head | Already implemented, at parity or better |
| 6 | Spectral lip sync | Our formant system is more sophisticated |
| 10 | Playback queue | Already have equivalent |

---

## Key Insight

Out of 12 features from Riko, only 1 is critical (#9 — TTS pipelining, which we already identified independently). 1 is important for mobile reliability (#12). The rest are either already implemented (#5, #10, #11 mobile), already surpassed (#6), or solve problems we don't have (#2, #3, #4).

**Riko's real advantage over us is execution speed on a narrower problem (desktop, single user, no auth).** Our advantage is product depth (memory, affection, auth, web deployment, multi-user). The competitive gap that matters is not feature parity — it's perceived responsiveness. Fix the TTS pipeline and we're ahead on everything that matters for a web companion app.
