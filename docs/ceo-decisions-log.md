# CEO Decisions Log (Compact)

Read this first. For full analysis on any topic, see `docs/ceo-archive/`.

---

## Active Decisions

### Company & Brand
- **Company name**: Aethris (approved). Pronunciation: "AY-thris". Check domain availability.
- **Character name**: Mona (keep for launch, review at 50 users). Genshin overlap risk.
- **Company vs character**: Separate. Footer says "Aethris", product says "Mona".
- **NSFW**: Permissive by default on web. SFW toggle available. Don't make it the brand identity.

### Business Model
- **Bootstrap** to profitability. Funding is optional, not necessary.
- **Pricing**: $7.99/mo subscription (Phase 2, month 2-3). Consider $12.99 NSFW premium tier.
- **Break-even**: 5-25 paying users depending on TTS strategy.
- **Target**: $5K MRR by month 12-18.

### TTS Strategy
- **Launch**: Fish Audio API ($0.003/call, $0/mo when idle). Voice cloning supported.
- **Fallback**: OpenAI TTS-1 (already implemented).
- **Scale (200+ voice users)**: Switch to SoVITS on dedicated RunPod pod ($137/mo).
- **Do NOT run GPU pod before paying users exist.**

### STT Strategy
- **Current**: OpenAI Whisper-1 (works, 1-2s latency)
- **Upgrade**: Groq Whisper Large v3 Turbo ($0.04/hr vs $0.36/hr, ~200ms)
- **Priority**: After TTS pipelining + PostHog. Defer if sprint is tight.

### Distribution
- **Web-first**, PWA at 500 users, native iOS at 2,000 users.
- **First users**: r/CharacterAI -> 50 users in 2 weeks. Viral hook: 30s screen recording.
- **Cross-post**: r/replika, anime Discords, AI Twitter.

### Product Philosophy
- Never gate emotional content behind paywalls
- Never use streak anxiety or loss aversion
- Monetize convenience and customization, not the relationship itself
- One deep character beats millions of shallow ones

---

## Roadmap

| Phase | Timeline | Goal |
|-------|----------|------|
| 0 | 2-4 weeks | Launch: deploy, landing page, domain, analytics, 50 users |
| 1 | Months 1-3 | PMF: 500 active users, D7 >30%, talk to every user |
| 2 | Months 3-8 | Monetize: subscription, cosmetics, $5K MRR |
| 3 | Months 8-18 | Scale: decide product vs platform based on data |

---

## Pre-Launch Sprint (2026-02-13 gap analysis)

**North star**: Make Mona feel responsive and present. Perceived latency is the #1 UX priority.

**Critical finding**: Sentence-level TTS pipelining is NOT working. `split_into_sentences()` exists but is never called. TTS runs on full LLM response only. This is the #1 bottleneck (adds 2-4s).

| # | Task | Effort | Priority | Reason |
|---|------|--------|----------|--------|
| 1 | Sentence-level TTS pipelining | 4h | P0 | Saves 2-4s on voice-to-first-audio |
| 2 | DB writes off critical path | 1h | P0 | Free 100-200ms, zero risk |
| 3 | PostHog analytics | 4h | P1 | Must be live before first users |
| 4 | Mobile audio unlock hardening | 1.5h | P1 | Prevent silent-voice bug on mobile browsers |
| 5 | Sentry error monitoring | 2h | P1 | Must have for production |
| 6 | Groq Whisper STT | 2h | P2 | Nice latency + cost win, not critical at low volume |
| 7 | crossFadeTo() blending | 2h | P2 | Polish |
| 8 | Listening nods (while user speaks) | 1.5h | P2 | Post-launch, when voice usage >20% |

**Cut line if tight**: Items 1-5 are non-negotiable (12.5h). Items 6-8 are week 1 post-launch.


---

## Launch Checklist Status

| Item | Status |
|------|--------|
| Clean avatar options (Vena only) | DONE |
| Build landing page | DONE |
| Terms & Privacy pages | DONE |
| Landing page copy overhaul | DONE |
| Landing page copy tweaks (header, card 3) | TODO |
| Live2D animated hero | TODO (week 1 post-launch) |
| Drop Sora font (Inter-only) | TODO |
| Buy domain | TODO |
| Deploy backend (Railway) | TODO |
| Deploy frontend (Vercel) | TODO |
| PostHog analytics | TODO |
| End-to-end testing | TODO |
| Demo video (30s) | TODO |
| Reddit post | TODO |
| Sentence-level TTS pipelining | TODO — P0 |
| DB writes off critical path | TODO — P0 |
| Sentry error monitoring | TODO |
| Mobile audio unlock hardening | TODO — P1 |
| Groq Whisper STT migration | TODO — P2 |
| crossFadeTo() animation blending | TODO — P2 |
| Listening nods (voice mode) | TODO — P2 |

---

## Deferred Features (do NOT build yet)

| Feature | Build when |
|---------|-----------|
| Subscription/payments | Month 2-3 |
| More avatars | 200+ users AND user requests |
| Male avatars | Data shows demand |
| Cosmetic catalog | After subscription exists |
| Streamer companions | Phase 2, if 4 conditions met (see archive) |
| Daily streaks | NEVER (wrong mechanic) |
| Currency/Petals | 1000+ paying subscribers |
| Relationship milestones | 5-10 users return for second session |
| Postgres migration | Hundreds of users |

---

## Key Metrics to Track

- D1, D7, D30 retention
- Messages per user per day
- Voice usage rate
- Guest -> signup conversion
- API cost per user
- Voice-to-first-audio latency (target: <3s)

---

## Competitive Intel (Summary)

- **Character.AI**: 20M MAU. Memory is #1 complaint. We solve this.
- **Replika**: Users angry about ERP removal + paywalled emotions.
- **Hume AI**: Emotion infrastructure. Google acqui-hired CEO (Jan 2026). Not a competitor -- potential supplier.
- **Gradium**: $70M seed for TTS/STT APIs. Potential 5th TTS engine option.
- **Riko**: Desktop companion. Good animation + TTS pipelining. No web, no auth, no memory system. We have deeper product. Feature review: 1 critical borrow (TTS pipeline, already planned), 1 important (mobile audio unlock), rest already implemented or not needed (see archive).
- **Market**: $120M+ revenue 2025, 64% YoY growth. Top 10% capture 89% of revenue.

---

## Archive Index

Full detailed analyses in `docs/ceo-archive/`:
- `2026-02-12-long-term-strategy.md` -- Strategy, moat, market analysis, competitive weaknesses
- `2026-02-12-funding-vs-bootstrapping.md` -- Unit economics, break-even, revenue projections, TTS cost analysis
- `2026-02-12-launch-checklist.md` -- Avatar decisions, full checklist, what NOT to build
- `2026-02-12-streamer-companions.md` -- Idea evaluation, competition, conditions to revisit
- `2026-02-12-naming-strategy.md` -- Aethris/Mona analysis, domain strategy, rename criteria
- `2026-02-12-landing-page-copy.md` -- Copy recommendations (implemented)
- `2026-02-12-landing-page-redesign.md` -- Live2D hero, typography, copy tweaks, missing elements
- `2026-02-13-pre-launch-polish.md` -- STT migration, pipeline optimization, animation improvements
- `2026-02-13-gap-analysis.md` -- Riko competitive gap analysis, sprint priorities, TTS pipelining finding
- `2026-02-13-riko-feature-review.md` -- 12-feature Riko deep dive: borrow/skip/defer decisions, sprint ordering
