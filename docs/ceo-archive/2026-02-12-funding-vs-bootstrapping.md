# Funding vs Bootstrapping (2026-02-12)

## DECIDED: Bootstrap to profitability. Funding is optional, not necessary.

## Unit Economics (Corrected for TTS costs)

### Per-message costs:
| Component | Cost | Notes |
|-----------|------|-------|
| GPT-4o-mini (main + background tasks) | ~$0.0003 | Text conversation |
| + STT (Whisper) | +$0.003 | Voice input |
| + TTS (Fish Audio API) | +$0.003 | Voice output |
| **Total text message** | **~$0.0003** | |
| **Total voice message** | **~$0.006** | |

### Per-user monthly cost (medium user, 25 msgs/day, ~12 voice):
| TTS Strategy | Cost/user/month |
|-------------|----------------|
| Fish Audio API (launch) | $1.26 |
| SoVITS pod (200+ users) | $0.45 |

### Infrastructure (pre-scale):
- No GPU pod at launch: $1-22/mo (domain + Vercel)
- With SoVITS pod (200+ users): $137/mo added

## Break-Even

**Fish Audio API (launch):** 5 paying users at $7.99/mo
**SoVITS pod (scale):** 25 paying users

## Revenue Projections (Conservative)

| Timeline | Active users | Paying (5-10%) | MRR |
|----------|-------------|----------------|-----|
| Month 3 | 200 | 15-20 | $120-160 |
| Month 6 | 500 | 40-50 | $320-400 |
| Month 12 | 3,000 | 250-300 | $2,000-2,400 |
| Month 24 | 15,000 | 1,500-2,000 | $12,000-16,000 |

## TTS Strategy

**Launch with Fish Audio API. Switch to SoVITS at 200+ voice users.**
- Below 200 users: API cheaper ($33.75 vs $137/mo at 50 users)
- Above 200 users: SoVITS saves money ($137 fixed vs scaling API costs)
- Cold start on serverless SoVITS is 30-60 seconds = product killer
- Fish Audio supports voice cloning (preserves Mona's voice)

## Comparable Bootstrapped Companies

| Company | Revenue | Funded? |
|---------|---------|---------|
| Candy.ai | $25M ARR | Bootstrapped |
| Chai AI | $30-40M ARR | Bootstrapped initially |
| Kindroid | ~$5M ARR | Unknown |

## Cost Optimization

1. Fish Audio API as default TTS ($0/mo when idle)
2. GPT-4o-mini for everything (16x cheaper than GPT-4o)
3. Aggressive audio caching (already implemented)
4. SQLite (free) until scale demands Postgres
5. Vercel free tier for frontend
6. Do NOT run GPU pod before paying users exist
