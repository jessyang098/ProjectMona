# Landing Page Redesign Strategy (2026-02-12)

## Key Decision: Animated Live2D Hero
- **Verdict**: YES, build it -- but as week-1 enhancement, not launch blocker
- Build lightweight `Live2DHero` wrapper: idle animations only (breathe, blink, head tilt, tail, wings)
- NO audio, lip sync, drag, dance, emotion props -- strip to display-only
- Lazy-load pixi.js + Cubism SDK; show static PNG placeholder until loaded
- Effort: 1-2 days for engineer familiar with codebase
- Impact: Biggest first-impression differentiator vs. all competitors

## Typography Decision
- Drop Sora font, use Inter-only
- Sora only used on "Aethris" nav text -- not worth a second font download
- Revisit brand typography when design system warrants it

## Copy Changes (Not Yet Implemented)
- **Section header**: Change "More than a chatbot" to something specific (e.g., "She actually pays attention")
- **Feature card 3** ("A Bond That Grows"): Make more concrete -- what does the affection system actually change? Inside jokes? Warmer tone? Teasing?
- **Bottom CTA section**: Either add founder note/testimonial or remove entirely -- redundant with hero CTA

## Missing Elements
1. **Social proof**: Add indie founder note for Reddit credibility (no testimonials available yet)
2. **Mobile verification**: Ensure 480px Vena image doesn't cause horizontal scroll on small screens
3. **Demo video placeholder**: Plan layout to accommodate 30s video when ready

## Launch Priority Order
1. Deploy backend + frontend (actual blocker)
2. Buy domain (blocker)
3. PostHog analytics (must have before first users)
4. Copy tweaks (30 min, do before launch)
5. Live2D hero (week 1 post-launch)
6. Demo video (after app is deployed and recordable)

## Primary Metric
- Landing page optimizes for: **page visit -> first message sent** conversion rate
- Not signup, not retention, not brand -- just get them into the 25-message guest funnel
