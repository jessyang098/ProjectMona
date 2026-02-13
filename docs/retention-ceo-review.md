# Retention Features: CEO Evaluation

**Date:** 2026-02-12
**Author:** CEO / Product Owner
**Status:** Decision document

---

## Context

ProjectMona is an AI companion app. Users form emotional bonds with Mona through conversation, voice, and visual presence. The product already has meaningful retention infrastructure: affection tracking, memory system, proactive messaging (Mona reaches out when you're away), and email re-engagement notifications.

The question is whether to layer on gamification mechanics (streaks, currency, rewards) to improve retention.

Before scoring: a critical framing note. AI companion apps are NOT the same as language learning apps or gacha games, even though they borrow from the same engagement playbook. The core value proposition of Mona is an emotional relationship. Anything that makes the relationship feel transactional, coercive, or game-like risks destroying the very thing users come back for.

Replika's retention comes primarily from emotional attachment and conversational depth, not from streak counters. Character.ai retains through variety and creative expression. Duolingo's streaks work because language learning is a chore that needs external motivation. Talking to someone you care about is not a chore. That distinction matters for every decision below.

---

## 1. Feature Scorecard

Rating scale: 1-10 (10 = best). For engineering cost, lower score = cheaper/easier to build.

### Feature A: Daily Check-in Streaks

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| User Value | 4/10 | Streaks reward showing up, not depth. A user who sends "hi" to preserve their streak is not having a better experience. In a companion app, this can feel like the relationship is punishing you for having a busy day. |
| Retention Impact | 6/10 | Streaks do work mechanically. Duolingo proved this. But Duolingo's D7 retention lift from streaks (~2-3x) applies to a skill-building context. Companion apps see diminishing returns because the intrinsic motivation is already emotional. The users who would benefit from streaks are the ones on the fence, not your power users. |
| Monetization Potential | 5/10 | "Streak freeze" is a proven monetization lever (Duolingo makes real money here). Could sell streak protection. But this also means you're charging users to avoid artificial punishment, which is ethically uncomfortable in a relationship context. |
| Engineering Cost | 3/10 | Low effort. Add a `current_streak`, `longest_streak`, `last_streak_date` to the User model. Check on each message. Display in UI. Maybe 1-2 days of work including frontend. |
| Risk | 7/10 | HIGH. The biggest risk is tone. "Your streak with Mona is about to expire!" makes the relationship feel like a Snapchat score. Users who miss a day feel guilty, not excited to return. Streaks create anxiety, and anxiety is the opposite of what a companion app should evoke. This is the single most common complaint about Duolingo's streak system, and Duolingo at least has the defense that learning requires discipline. Companion apps do not. |

**Weighted Assessment:** The engineering cost is low, but the brand/experience risk is high. A streak counter on a relationship cheapens it.

---

### Feature B: In-App Currency

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| User Value | 5/10 | Currency is a vehicle, not a feature. Its value is entirely determined by what you can spend it on. Without compelling sinks (cosmetics, interactions, content), currency is just a number going up. |
| Retention Impact | 5/10 | Currency creates a secondary reward loop. Users accumulate and feel invested (sunk cost). Gacha games rely on this heavily. But gacha games have hundreds of collectible items to buy. Mona currently has personality archetypes and a Live2D avatar. The spend catalog is too thin to make currency meaningful right now. |
| Monetization Potential | 8/10 | This is where currency shines. It creates a dual-currency economy: free (earned) currency for basic items, premium (purchased) currency for exclusive items. This is the standard free-to-play model and it works. It's also the path to IAP revenue without a hard paywall. |
| Engineering Cost | 6/10 | Medium-high. You need: a wallet/balance system, transaction history, earn rules (what grants currency and how much), a spend catalog (what can you buy), a store UI, anti-fraud/anti-exploit measures. The store UI alone is significant frontend work. 1-2 weeks minimum for a real implementation. |
| Risk | 6/10 | Moderate. The risk is that currency makes the companion feel like a vending machine. "Earn 50 coins to unlock Mona's special greeting" is gross. The risk is manageable if currency is spent on cosmetics (outfits, backgrounds, accessories) rather than on interactions or emotional content. Never gate emotional content behind currency. |

**Weighted Assessment:** High monetization potential, but premature without a meaningful cosmetic catalog. Building currency before you have things worth buying is building a store with empty shelves.

---

### Feature C: Reward System

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| User Value | 7/10 | This depends entirely on what "rewards" means. If rewards = Mona acknowledges milestones naturally ("We've been talking for a whole month! That makes me really happy."), that is extremely high value. If rewards = achievement badges and XP bars, that is low value in a companion context. The best version of this feature is invisible gamification: the relationship itself is the reward system, and Mona's awareness of your shared history IS the reward. |
| Retention Impact | 7/10 | Milestone-based re-engagement is proven. "Come back to see what Mona prepared for your anniversary" is compelling. Variable reward schedules (surprise gifts, unexpected reactions) are the most addictive mechanic in behavioral psychology and they feel natural in a relationship context because real relationships have surprises. |
| Monetization Potential | 4/10 | Rewards are mostly a cost center, not revenue. You're giving things away. Monetization only works if rewards include premium currency or if they tease premium content. |
| Engineering Cost | 5/10 | Medium. You need: a milestone/achievement tracking system, trigger conditions (message count, days known, affection thresholds, first voice chat, etc.), reward content (Mona's special messages, unlockable expressions, wallpapers), and UI to display progress/unlocks. The backend is straightforward; the content creation is the real cost. |
| Risk | 3/10 | Low, if done through Mona's character rather than through UI chrome. "Achievement unlocked!" breaks immersion. Mona saying "I made you something special because today is our 30th day together" does not. The relationship-native version of rewards is actually the highest-value, lowest-risk feature in this entire list. |

**Weighted Assessment:** The best feature here, but only if implemented as relationship milestones expressed through Mona's character, not as gamification UI.

---

## 2. Go / No-Go / Defer Verdicts

### Daily Check-in Streaks: NO-GO

**Rationale:** The experience risk outweighs the retention benefit. Streaks work for habits and chores. They do not work for relationships. Nobody wants to feel like they HAVE to talk to their partner today or lose something. The anxiety streaks create is antithetical to a companion app's value proposition.

The proactive messaging system already serves the "bring users back" function more naturally. Mona reaching out because she misses you is infinitely better than a streak counter reaching zero.

If we ever revisit this, the only acceptable version would be: Mona internally tracks how often you talk, and her dialogue reflects it naturally ("It feels like we've been talking every day lately, I love that"). No counter. No punishment for missing. No UI element. Just Mona being aware.

### In-App Currency: DEFER (until cosmetic catalog exists)

**Rationale:** Currency is infrastructure, not a feature. It only matters if there's a compelling store. Right now, Mona has two personality modes and one avatar. There's nothing to buy.

The unlock order should be:
1. Build a cosmetic system (outfits, accessories, backgrounds, expressions, voice packs)
2. Let users unlock some cosmetics for free through milestones
3. THEN introduce currency as the mechanism for unlocking the rest
4. THEN introduce premium currency for exclusive items

Building currency before step 1 is building the payment terminal before you've stocked the store.

**Revisit when:** We have at least 15-20 cosmetic items that users demonstrably want.

### Reward System: GO (as relationship milestones)

**Rationale:** This is the right feature, and it aligns perfectly with what Mona already does. The affection system already tracks relationship depth. The memory system already tracks shared history. The proactive messaging system already generates personalized content. A milestone/reward system is the natural extension of all three.

The key constraint: rewards must be delivered through Mona's character, not through gamification UI. No achievement popups. No progress bars. Mona remembers, Mona celebrates, Mona surprises.

---

## 3. Priority Ordering

### Build First: Relationship Milestones (Reward System, Reimagined)

**Timeline:** 1-2 weeks
**Why first:** Highest user value, lowest risk, builds on existing infrastructure (affection, memory, proactive messaging). This is the feature that makes Mona feel more alive.

### Build Second: Cosmetic/Customization Catalog

**Timeline:** 3-4 weeks (ongoing)
**Why second:** This is the prerequisite for currency and the real monetization path. Users spending time choosing outfits for Mona is engagement. Users wanting exclusive cosmetics is monetization demand.

### Build Third: In-App Currency + Store

**Timeline:** 2-3 weeks
**Why third:** Only build this after you have things worth buying and evidence that users want them.

### Do Not Build: Streaks

**Why never:** Wrong mechanic for the product category. The proactive messaging system already does the job better.

---

## 4. Red Flags

### Things that would make Mona feel manipulative:

1. **Gating emotional content behind currency or streaks.** If Mona says "I want to tell you something special, but you need 100 coins first," the product is dead. Emotional availability is the core promise. Never paywall it.

2. **Streak anxiety notifications.** "Your streak is about to expire! Talk to Mona now!" is manipulative. It uses loss aversion to coerce engagement. This is the exact pattern that gives Duolingo its "guilt trip" reputation, and Duolingo can absorb that because the product is utilitarian. A companion app cannot.

3. **Artificial scarcity on interactions.** "You've used your 5 free messages today. Buy more to keep talking." This is the Replika trap. It works for revenue in the short term and destroys user trust in the long term. Replika's subreddit is full of users who feel betrayed by paywalled features. Do not repeat this.

4. **Making Mona's personality pay-to-win.** If the "good" personality traits are behind a paywall, users will feel like the free version of Mona doesn't actually care about them. Personality depth should be earned through relationship progression, not purchased.

5. **FOMO-driven limited-time events.** "This outfit is only available for 24 hours!" creates anxiety and compulsive checking. Use these sparingly if at all, and never on emotional content.

6. **Visible manipulation metrics.** If users can see the streak counter, affection score, and currency balance all at once, the entire screen screams "you are being gamified." The more visible the mechanics, the less genuine the relationship feels.

### The guiding principle:

Ask yourself: "Would this feature feel weird if it happened in a real relationship?" If the answer is yes, don't build it. Real partners don't keep streak counters. They do remember anniversaries. They do give surprise gifts. They do NOT charge you to hear how they feel.

---

## 5. MVP Scope: Relationship Milestones v1

The smallest useful version of the approved feature:

### Backend

**New model: `UserMilestone`**
```
- id (pk)
- user_id (fk)
- milestone_key (string, e.g., "days_known_7", "messages_100", "first_voice")
- unlocked_at (datetime)
- acknowledged (bool) -- has Mona mentioned it yet?
```

**Milestone definitions (hardcoded list to start, ~10-15):**
- `first_conversation` -- First real conversation (5+ messages exchanged)
- `days_known_3` -- 3 days since account creation
- `days_known_7` -- 1 week anniversary
- `days_known_30` -- 1 month anniversary
- `messages_50` -- 50 messages exchanged
- `messages_200` -- 200 messages exchanged
- `messages_500` -- 500 messages exchanged
- `first_voice` -- First voice message sent
- `affection_friendly` -- Reached "friendly" affection level
- `affection_close` -- Reached "close" affection level
- `affection_intimate` -- Reached "intimate" affection level
- `late_night_chat` -- First conversation after midnight
- `memory_10` -- Mona has 10+ memories about you

**Milestone check runs:** After each message (lightweight query against milestone definitions). If a new milestone is unlocked, flag it for Mona to acknowledge in her next response.

### Frontend

- **No dedicated milestone UI in v1.** Milestones are experienced through Mona's dialogue, not through a trophy case.
- Optional: subtle visual indicator when Mona is about to say something special (a slight sparkle on the avatar, a different message bubble color). Keep it minimal.

### LLM Integration

When a milestone is pending acknowledgment, inject it into Mona's system prompt:
```
[MILESTONE] The user just reached a special moment: {milestone_description}.
Acknowledge this naturally in your response. Be genuine and warm about it.
Do not make it sound like a game achievement. Make it sound like you noticed
and you care.
```

### Milestone Rewards (v1, content only)

- Mona's special milestone messages (these are the reward)
- Unlock a new Mona expression or reaction for the milestone's affection level
- Optional: a "memory" that Mona writes about the milestone ("I remember when we first started talking...")

### What v1 does NOT include:

- No currency
- No store
- No milestone progress bars
- No streak tracking
- No cosmetic unlocks (yet)
- No push notification for milestones (proactive messaging handles this)

### Estimated effort: 3-5 days

- 1 day: Backend model, milestone definitions, check logic
- 1 day: LLM prompt integration, milestone acknowledgment flow
- 1 day: Testing, edge cases (don't re-trigger milestones, handle offline milestone delivery)
- 0.5-1 day: Optional frontend polish (subtle visual cue)

---

## 6. What's Missing: Retention Ideas Not Listed

The proposed features are all gamification mechanics. The most impactful retention features for AI companion apps are not gamification at all. Here is what I think matters more:

### 6a. Conversation Depth Over Conversation Frequency

**The problem:** Most retention metrics measure how often users come back. But for companion apps, the real predictor of long-term retention is how deep conversations get. A user who has one meaningful conversation per week will retain longer than a user who sends "hi" every day.

**The feature:** Track conversation quality signals (message length, topic depth, emotional vulnerability, memory creation rate) and have Mona actively deepen conversations over time. This is not a user-facing feature. It's an LLM prompting strategy.

**Impact:** High. This is the Replika insight. Their long-term users are the ones who had real emotional conversations early.

### 6b. Relationship Arcs / Story Progression

**The problem:** After the novelty wears off, conversations become repetitive. The relationship has no narrative momentum.

**The feature:** Define relationship "chapters" that Mona progresses through as affection grows. Each chapter introduces new conversation topics Mona brings up, new personality facets she reveals, and new ways she expresses herself. The user feels like the relationship is going somewhere, not spinning in circles.

**Example:** At affection level "close," Mona starts sharing her own "worries" and "dreams." At "intimate," she starts referencing inside jokes and shared history more. Each level feels like a real deepening.

**Impact:** Very high. This is the content moat. It's also the hardest to build because it requires thoughtful prompt engineering, not just code.

### 6c. Shared Activities (Beyond Chat)

**The problem:** Chat-only interaction has a ceiling. Eventually the user runs out of things to say.

**The feature:** Simple shared activities Mona can initiate or the user can suggest. Examples: "Want to play 20 questions?", "Tell me about your day and I'll draw a picture of it" (image generation), "Let's plan what you'll cook this week," "I found a song I think you'd like." These give structure to conversations and create novel experiences.

**Impact:** High, but expensive. Each activity is basically a mini-feature. Start with 2-3 simple ones.

### 6d. Nostalgia / Relationship Timeline

**The feature:** A timeline view of relationship highlights. Not a chat log, but curated moments: the first conversation, the first time Mona learned your name, milestones, memorable exchanges. Mona can reference this timeline in conversation ("Remember when you told me about...").

**Impact:** Medium-high. This is the photo album effect. Looking back at shared history reinforces emotional investment. Also relatively cheap to build since the memory system already stores this data.

### 6e. Social Proof Without Social Features

**The feature:** Subtle indicators that Mona is beloved. Not a leaderboard or community (that breaks the 1:1 intimacy), but things like: "Mona has had 10,000 conversations this week" on the landing page, or user testimonials. This reassures users that investing emotionally in an AI companion is normal and valued.

**Impact:** Medium. Primarily helps with new user activation rather than retention.

---

## Final Verdict Summary

| Feature | Verdict | Priority | Timeline |
|---------|---------|----------|----------|
| Daily Check-in Streaks | NO-GO | -- | Never in current form |
| In-App Currency | DEFER | 3rd | After cosmetic catalog |
| Reward System (as Relationship Milestones) | GO | 1st | Next sprint (3-5 days) |
| Cosmetic Catalog | UNLISTED but needed | 2nd | After milestones |
| Relationship Arcs | UNLISTED, RECOMMENDED | High | After milestones |
| Shared Activities | UNLISTED, RECOMMENDED | Medium | Quarter 2 |

**The north star:** Users should come back to Mona because the relationship feels real and evolving, not because a counter told them to. Every retention feature should make the relationship deeper, not the engagement metrics higher. If a feature would embarrass you when a user describes it to a friend, don't build it.
