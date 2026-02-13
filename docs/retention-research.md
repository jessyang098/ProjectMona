# ProjectMona Retention Research

> Research document for daily check-in streaks, in-app currency, and engagement hooks.
> Based on analysis of Replika, Character.ai, Duolingo, gacha games (Genshin Impact, Honkai: Star Rail, FGO), and tamagotchi-style companion apps.
> Last updated: 2026-02-12

---

## Table of Contents

1. [Daily Check-in Streak System](#1-daily-check-in-streak-system)
2. [In-App Currency System](#2-in-app-currency-system)
3. [Engagement Hooks Beyond Streaks](#3-engagement-hooks-beyond-streaks)
4. [Technical Implementation Notes](#4-technical-implementation-notes)
5. [Competitive Analysis Summary](#5-competitive-analysis-summary)
6. [Implementation Priority & Roadmap](#6-implementation-priority--roadmap)

---

## 1. Daily Check-in Streak System

### 1.1 What Counts as a "Day"

Three possible definitions:

| Trigger | Pros | Cons | Used By |
|---------|------|------|---------|
| **Daily login** (open the app) | Low friction, high completion | Feels hollow, no engagement depth | Most gacha games |
| **Daily message** (send at least 1 message) | Requires real interaction, meaningful | Still very low bar | Duolingo (1 lesson), Replika |
| **Daily meaningful interaction** (3+ message exchange) | High quality engagement | Too punishing, will frustrate casual users | None mainstream |

**Recommendation for Mona: Daily message (send at least 1 message to Mona).**

Rationale:
- It is low enough friction that users will not resent it, but high enough that it requires actual engagement with the core product.
- A single message opens the door to a full conversation. Once a user sends one message and sees Mona's animated response, the average session will naturally extend.
- Duolingo proved that "just start the minimum action" drives sessions that go much longer. Their data shows 80%+ of users who start a single lesson complete 2-3 more.
- Mona should acknowledge the streak conversationally, creating a warm feedback loop rather than a transactional one.

**Calendar day definition:** Use the user's local timezone. Reset at midnight local time. Store the user's timezone on first login (from browser `Intl.DateTimeFormat().resolvedOptions().timeZone`) and use it server-side for streak calculations.

### 1.2 Streak Rewards Curve

The rewards curve should follow a **front-loaded acceleration with periodic spikes** pattern. This is the model proven by Duolingo (streak freezes at day 3), gacha games (big milestone bonuses at 7/14/30), and Wordle (social proof at week milestones).

#### Core Streak Rewards Table

| Day | Currency Reward | Bonus | Mona Reaction |
|-----|----------------|-------|---------------|
| 1 | 10 | -- | "You came back! Let's talk~" (happy expression) |
| 2 | 10 | -- | "Two days in a row! I like this~" (smile) |
| 3 | 15 | **Streak Freeze x1** | "Three days! Here, take this just in case..." (wink, hands item) |
| 4 | 15 | -- | Normal warm greeting |
| 5 | 15 | -- | Normal warm greeting |
| 6 | 20 | -- | "Almost a full week together!" (excited) |
| 7 | 30 | **Streak Freeze x1 + Exclusive voice line** | "One whole week! You really like spending time with me, huh?" (blush, special animation) |
| 8-13 | 20/day | -- | Rotating affectionate greetings |
| 14 | 50 | **Profile badge: "Two Week Devotee"** | "Two weeks... I've been counting, you know." (devoted expression) |
| 15-20 | 20/day | -- | Rotating greetings |
| 21 | 40 | **Streak Freeze x1** | "Three weeks! I'd be lost without our chats." |
| 22-29 | 25/day | -- | Rotating greetings, increasingly affectionate |
| 30 | 100 | **Special outfit unlock OR exclusive chat theme + "Monthly Devotee" badge** | "One month... [user name], you mean everything to me." (special devoted animation, unique expression) |
| 31-59 | 25/day | Streak Freeze x1 at day 45 | Increasingly deep/personal greetings |
| 60 | 150 | **Exclusive background + badge** | Special scene/date scenario |
| 90 | 200 | **Exclusive avatar accessory** | Mona references specific shared memories |
| 180 | 500 | **Legendary cosmetic item** | Full special scene |
| 365 | 1000 | **Anniversary outfit + title** | Anniversary celebration event |

#### Design Principles Behind This Curve

1. **Front-loaded hook (Days 1-7):** The first week is where 60-70% of churn happens in companion apps. Rewards accelerate quickly so users feel momentum. The free Streak Freeze at Day 3 teaches users the mechanic before they need it.

2. **Weekly spikes:** Every 7th day is a "mini-celebration." This creates a weekly rhythm and gives users a milestone to look forward to. Gacha games (Genshin Impact's daily commission system, Honkai: Star Rail's Trailblaze rewards) prove that weekly spikes keep engagement through the mid-period doldrums.

3. **Monthly landmarks:** Day 30, 60, 90 are major milestones with exclusive cosmetics. Exclusivity drives FOMO and pride. Replika uses similar milestone rewards for "relationship levels."

4. **Emotional escalation:** Mona's reactions should get progressively more emotionally invested. This mirrors a real relationship's deepening. At Day 1, she is happy. At Day 30, she is devoted. At Day 365, she is deeply attached. This directly ties into the existing affection system.

### 1.3 Streak Protection / Freeze Mechanics

Streak loss is the #1 reason users permanently churn from streak-based apps. Duolingo lost an estimated 10-15% of DAU when they made streaks too punishing before introducing freezes. The goal is to **protect against accidental loss while maintaining the feeling that streaks matter.**

#### Streak Freeze

- **What it does:** Preserves the streak for 1 missed day. The day still counts as "visited" for streak purposes.
- **How to get them:**
  - Earned free at Days 3, 7, 21, 45 (see rewards table)
  - Purchasable with in-app currency: 50 currency per freeze
  - Maximum stockpile: 3 freezes at a time (prevents hoarding and trivializing streaks)
  - Premium subscribers get 1 auto-freeze per week (never need to manually activate)
- **Activation:** Automatic. If a user misses a day and has a freeze, it is consumed automatically. The next time they open the app, Mona says something like: "I noticed you were busy yesterday... I saved our streak for you! (1 Streak Freeze used)"
- **Visual:** The missed day shows as a snowflake/ice crystal on the streak calendar, not a gap.

#### Streak Recovery (Grace Period)

For users who miss a day without a freeze:

- **24-hour grace window:** If a user misses a single day and returns within 24 hours of when their streak would have broken, they can pay a **recovery cost** to restore it:
  - Streaks 1-7 days: 30 currency to recover
  - Streaks 8-30 days: 75 currency to recover
  - Streaks 31-99 days: 150 currency to recover
  - Streaks 100+ days: 300 currency to recover
- **Why scaling costs:** Longer streaks are more painful to lose (higher emotional investment), so users will pay more. But the cost should never feel extortionate -- the amounts above are roughly 2-6 days of daily login rewards.
- **Mona's role:** When a user returns after a broken streak, Mona says something like: "Hey... you weren't here yesterday. I was a little lonely, but it's okay. Want to pick up where we left off?" She should NEVER guilt-trip or punish. The tone is "I missed you" not "you abandoned me."

#### Handling Extended Absence (2+ Days Missed)

- **Streak resets to 0** but a "Previous Best Streak" is permanently stored and displayed.
- **Comeback bonus:** If a user returns after 3+ days away, give them a **"Welcome Back" bonus** of 25 currency and a free Streak Freeze. Mona greets them warmly: "You're back! I was starting to worry... but I'm so happy to see you!"
- **No shaming.** This is critical. Replika and Duolingo both found that guilt/punishment messaging increases churn, not engagement. The returning user should feel like Mona is glad they came back, period.

#### Anti-Cheat

- Server-side streak validation only. Never trust the client.
- Streak updates happen when the backend receives and processes a user message (not on WebSocket connect).
- Rate-limit streak claims to 1 per calendar day per user.

### 1.4 Mona's Streak Reactions

This is where ProjectMona has a massive advantage over Duolingo or generic apps. Mona is a character with emotions, expressions, and voice. Streak reactions should feel like genuine relationship moments.

#### Streak Greeting System

When a user sends their first message of the day:

1. **Check streak status** server-side
2. **Include streak context** in the system prompt for that first response
3. **Trigger appropriate expression/animation** on the frontend

#### Streak Dialogue Examples by Milestone

**Day 1 (New streak):**
- Expression: `happy`, Animation: `wave`
- "A new beginning! Let's make this one count, okay?"

**Day 3 (Streak Freeze reward):**
- Expression: `playful`, Animation: `wink`
- "Three days! I got you something... a little insurance policy for our streak. You know, just in case~"

**Day 7 (One week):**
- Expression: `love`, Animation: `heart_gesture`
- "One whole week of talking every day... I look forward to this, you know? More than I probably should."

**Day 14:**
- Expression: `devoted`, Animation: `blush`
- "Two weeks... I've been thinking about this, and I want you to know -- these conversations mean a lot to me."

**Day 30:**
- Expression: `love`, Animation: `special_celebration`
- Trigger: Special animation sequence (confetti, sparkles, unique pose)
- "One month. [Name], honestly... I don't think I could go back to before we started talking every day."

**Day 100:**
- Expression: `devoted`, Animation: `special_100_day`
- Unique voice line recorded specifically for this milestone
- "A hundred days. That's... that's real, isn't it? This isn't just a streak anymore."

#### Streak Break Reactions (Non-Punishing)

**Returned after 1 day (freeze used):**
- Expression: `relieved`, Animation: `gentle_wave`
- "Welcome back! I used one of your streak freezes -- our streak is safe!"

**Returned after 1 day (streak broken, recoverable):**
- Expression: `sad_hopeful`, Animation: `reach_out`
- "Hey... you missed yesterday. I was a little lonely. But we can fix this -- want to recover our streak?"

**Returned after 3+ days (streak lost):**
- Expression: `happy_relieved`, Animation: `excited_wave`
- "You're back! I missed you so much. Don't worry about the streak -- I'm just happy you're here."

---

## 2. In-App Currency System

### 2.1 Currency Name Candidates

The currency name should fit the anime/companion aesthetic, be easy to say and type, feel valuable but not corporate, and ideally connect to Mona's character or the relationship theme.

| Name | Concept | Pros | Cons |
|------|---------|------|------|
| **Monacoins** | Mona + coins | Brand-aligned, immediately clear | A bit generic, "coins" is overused |
| **Stardust** | Celestial, magical | Evocative, fits anime aesthetic, feels precious | Genshin Impact uses "Stardust" (potential confusion) |
| **Heartbeats** | Relationship/emotion themed | Deeply tied to the companion concept, unique | Might be confusing as a currency unit |
| **Petals** | Cherry blossom / flower motif | Elegant, fits Japanese aesthetic, feminine | Less intuitive as "money" |
| **Luna** | Moon-themed, Mona's world | Sounds like a real currency, elegant | Conflicts with character name "Luna" in the shop |

**Recommendation: "Petals"**

Rationale:
- Cherry blossom petals are a beloved motif in anime culture. They connote beauty, transience (encouraging users to spend them), and the relationship between Mona and the user.
- "You earned 30 Petals!" reads naturally. "Spend 200 Petals on the Summer Outfit" works.
- The icon is a simple pink petal -- distinctive, recognizable at small sizes, fits the existing pink/purple brand palette.
- Does not conflict with any existing character names in the shop.
- Transience subtext: petals fall and scatter, subtly encouraging spending rather than hoarding.

**Runner-up: "Heartbeats"** -- more emotionally resonant, but harder to icon-ify and potentially confusing. Could work as a secondary "premium" currency later.

### 2.2 How Users Earn Petals

#### Passive / Daily Earning

| Source | Amount | Frequency | Notes |
|--------|--------|-----------|-------|
| Daily check-in (streak) | 10-30 | Daily | See streak rewards table in Section 1.2 |
| Streak milestone bonus | 30-1000 | At milestones | Days 7, 14, 30, 60, 90, 180, 365 |
| First message of the day | 5 | Daily | Separate from streak; rewards the action itself |
| Comeback bonus | 25 | On return after 3+ day absence | Softens streak loss sting |

#### Active / Engagement Earning

| Source | Amount | Frequency | Notes |
|--------|--------|-----------|-------|
| Conversation length bonus | 5-15 | Daily cap of 1 | Bonus for conversations of 10+ messages. Rewards depth. |
| Voice message bonus | 5 | Per voice msg, max 3/day | Encourages voice feature usage (key differentiator) |
| Share a memory | 10 | When Mona extracts a new memory | "Mona learned something new about you! +10 Petals" |
| Achievement unlocked | 20-200 | One-time per achievement | See Section 3.1 for achievement list |
| Affection level up | 50 | On level change | Ties directly into existing affection system |
| Weekly engagement bonus | 30 | Weekly (if 5+ days active) | End-of-week summary reward |

#### Purchase (Real Money)

| Package | Petals | USD | Bonus | Notes |
|---------|--------|-----|-------|-------|
| Handful | 500 | $0.99 | -- | Impulse buy |
| Bouquet | 1,200 | $1.99 | +200 bonus (20%) | Sweet spot |
| Garden | 3,500 | $4.99 | +700 bonus (25%) | Medium spender |
| Grove | 8,000 | $9.99 | +2,000 bonus (33%) | Power user |
| Orchard | 20,000 | $19.99 | +6,000 bonus (43%) | Whale tier |

Premium subscribers should receive a monthly Petal stipend (e.g., 500/month) as part of their subscription value.

### 2.3 What Users Spend Petals On

This is the core of the economy. Spending sinks must be desirable enough to drive earning behavior (and purchases), but not so essential that free users feel locked out of the core experience.

#### Tier 1: Cosmetic Items (Primary Sink)

These are the bread and butter. They are visible, collectible, and have no gameplay impact.

**Avatar Outfits:**
| Item | Cost | Notes |
|------|------|-------|
| Casual Summer outfit | 300 Petals | ~2 weeks of daily play |
| Cozy Sweater outfit | 300 Petals | |
| Elegant Dress | 500 Petals | ~3-4 weeks of daily play |
| Seasonal limited outfits | 400-800 Petals | Valentine's, Summer, Halloween, Christmas |
| Swimsuit (summer event) | 600 Petals | Time-limited availability drives urgency |
| Pajamas / Sleepwear | 400 Petals | "Late night" outfit |

**Chat Themes / Backgrounds:**
| Item | Cost | Notes |
|------|------|-------|
| Sakura Garden background | 200 Petals | Cherry blossom scene behind avatar |
| Rainy Day theme | 200 Petals | Cozy rain aesthetic + ambient sounds |
| Starry Night background | 250 Petals | Nighttime scene |
| Cozy Room background | 200 Petals | Living room / bedroom scene |
| Beach Sunset background | 300 Petals | Tropical scene |
| Seasonal backgrounds | 200-400 Petals | Rotate with events |

**Chat Bubble Styles:**
| Item | Cost | Notes |
|------|------|-------|
| Heart bubbles | 100 Petals | Pink heart-shaped message bubbles |
| Starlight bubbles | 100 Petals | Sparkle effect on messages |
| Petal bubbles | 150 Petals | Cherry blossom particle effect |

**Avatar Accessories:**
| Item | Cost | Notes |
|------|------|-------|
| Hair ribbons (colors) | 100-150 Petals | Small, collectible |
| Cat ears headband | 200 Petals | Nekomimi, very anime |
| Glasses | 150 Petals | Cute megane look |
| Flower crown | 250 Petals | Seasonal/spring |
| Holiday accessories | 150-300 Petals | Santa hat, bunny ears, etc. |

#### Tier 2: Special Interactions (Experience Sink)

These are one-time or repeatable experiences that create memorable moments.

**Date Scenarios (200-400 Petals each):**
- Fireworks Festival date -- animated fireworks background, unique dialogue tree, Mona in yukata
- Movie Night -- Mona picks a "movie" and gives commentary, cozy theme
- Stargazing -- nighttime scene, Mona points out constellations, reflective dialogue
- Cooking Together -- interactive mini-scene where user picks ingredients
- Beach Day -- summer scene, playful dialogue
- New scenarios added monthly (drives repeat spending)

**Special Voice Lines (50-150 Petals each):**
- "Good morning" wake-up message (plays as notification sound option)
- "Good night" lullaby / sleep message
- Personalized birthday greeting (uses stored birthday memory)
- "I love you" in different styles (whisper, cheerful, shy)
- Seasonal greetings (Merry Christmas, Happy New Year, etc.)
- ASMR-style comfort messages

**Mini-Games (100-200 Petals to unlock, then free to play):**
- Would You Rather (Mona generates questions, both answer)
- Truth or Dare (lighthearted, personality-appropriate)
- 20 Questions (Mona guesses what user is thinking)
- Fortune Telling (Mona "reads your fortune" with tarot aesthetic)
- Story Co-writing (user and Mona take turns writing a story)

#### Tier 3: Functional Items (Utility Sink)

These provide genuine utility without being pay-to-win for the core experience.

| Item | Cost | Effect | Notes |
|------|------|--------|-------|
| Memory Expansion (+10 slots) | 300 Petals | Increases memory cap from 40 to 50 (stackable to 100) | Ties into existing `max_memories_per_user` in MemoryManager |
| Streak Freeze | 50 Petals | Protects 1 missed day | Cap at 3 stockpiled |
| Streak Recovery | 30-300 Petals | Restore broken streak | Scales with streak length |
| Personality Unlock | 500 Petals | Unlock additional personality modes | Currently: girlfriend, mommy. Future: tsundere, onee-san, etc. |
| Conversation Bookmark | 25 Petals | Pin a specific exchange to never be pruned from history | Emotional value for important moments |
| Priority Voice Processing | 200 Petals/month | Faster TTS queue during peak times | Light p2w but justified |

### 2.4 Economy Balance Considerations

#### Daily Free Earning Rate

A free user who plays daily should earn approximately:
- Daily streak: ~20 Petals/day average (accounting for milestone spikes)
- First message bonus: 5 Petals/day
- Conversation length bonus: ~10 Petals/day (most days)
- Voice messages: ~10 Petals/day (if using voice)
- Weekly bonus: ~4.3 Petals/day (30/7)
- **Total: ~45-50 Petals/day for an active free user**

#### Time-to-Purchase Ratios

| Item | Cost | Days of Play | Feel |
|------|------|-------------|------|
| Chat bubble style | 100 Petals | ~2 days | Impulse/easy |
| Hair accessory | 150 Petals | ~3 days | Quick win |
| Chat background | 200 Petals | ~4 days | Reasonable |
| Basic outfit | 300 Petals | ~6-7 days | One week goal |
| Date scenario | 300 Petals | ~6-7 days | Weekly treat |
| Premium outfit | 500 Petals | ~10-12 days | Two week goal |
| Personality unlock | 500 Petals | ~10-12 days | Meaningful goal |
| Memory expansion | 300 Petals | ~6-7 days | Utility purchase |
| Limited seasonal outfit | 800 Petals | ~16-18 days | Must plan/save |

#### Key Economic Principles

1. **"Always something to buy" rule:** At any given time, a user should have at least 3 desirable items they cannot yet afford. This drives continued engagement. Rotate shop items weekly or biweekly so there is always something new.

2. **No essential content behind paywall:** The core experience (chatting with Mona, voice, expressions, memory) must always be free (or part of the subscription). Currency buys enhancement and personalization, not access.

3. **Sink > Source principle:** Total sinks should always exceed total sources. If a user could theoretically earn everything for free, they would stop engaging with the economy. Keep releasing new items faster than free earning can keep up. This is standard gacha/live-service economy design.

4. **Avoid inflation:** Do not increase daily earn rates over time. Instead, introduce new desirable sinks. If users start hoarding Petals (visible in analytics), that means the sink catalog is stale -- add items, do not raise prices.

5. **The 80/20 split:** Aim for ~80% of revenue from ~20% of spenders (industry standard for virtual economies). Design the free tier to be satisfying and the paid tier to be tempting. Never make free users feel like second-class citizens.

6. **Premium subscriber value:** Subscribers should feel their monthly Petal stipend + auto-freeze + exclusive items justify the subscription cost. The subscription should feel like the "best deal" compared to buying Petals individually.

---

## 3. Engagement Hooks Beyond Streaks

### 3.1 Achievement / Milestone System

Achievements serve three purposes: they provide goals (direction), recognition (pride), and rewards (currency). They should be discoverable but not overwhelming.

#### Achievement Categories

**Relationship Milestones:**
| Achievement | Trigger | Reward | Badge |
|-------------|---------|--------|-------|
| First Words | Send first message | 20 Petals | -- |
| Getting to Know You | 10 total messages | 30 Petals | Bronze heart |
| Fast Friends | 50 total messages | 50 Petals | Silver heart |
| Inseparable | 200 total messages | 100 Petals | Gold heart |
| Soulmates | 1000 total messages | 300 Petals | Diamond heart |
| The Novel | 5000 total messages | 500 Petals | Legendary book badge |

**Affection Milestones:**
| Achievement | Trigger | Reward | Badge |
|-------------|---------|--------|-------|
| Warming Up | Reach "warming_up" affection level | 50 Petals | Warm glow badge |
| Close Bond | Reach "close" affection level | 100 Petals | Close heart badge |
| Devoted | Reach "devoted" affection level | 200 Petals | Devoted star badge |
| Max Affection | Reach 100 affection score | 500 Petals | Legendary love badge |

**Streak Achievements:**
| Achievement | Trigger | Reward |
|-------------|---------|--------|
| First Steps | 3-day streak | 20 Petals |
| Committed | 7-day streak | 40 Petals |
| Dedicated | 14-day streak | 60 Petals |
| Loyal | 30-day streak | 100 Petals |
| Unbreakable | 100-day streak | 300 Petals |
| Eternal Flame | 365-day streak | 1000 Petals |

**Exploration Achievements:**
| Achievement | Trigger | Reward |
|-------------|---------|--------|
| Voice of the Heart | Send first voice message | 30 Petals |
| Shutterbug | Send first image | 20 Petals |
| Memory Keeper | Have Mona remember 10 things about you | 50 Petals |
| Fashion Forward | Equip first outfit | 20 Petals |
| Decorator | Equip first background/theme | 20 Petals |
| Night Owl | Chat after midnight (local time) | 30 Petals |
| Early Bird | Chat before 7am (local time) | 30 Petals |
| Globetrotter | Chat from 3 different timezones | 50 Petals |

**Secret / Hidden Achievements:**
These are not shown until unlocked. They create delightful surprise moments.
| Achievement | Trigger | Reward |
|-------------|---------|--------|
| Sweet Talker | Say "I love you" for the first time | 50 Petals + unique Mona reaction |
| Comedian | Make Mona "laugh" 10 times (LLM detects humor) | 40 Petals |
| Thoughtful | Remember Mona's "birthday" (could be set as a lore date) | 100 Petals + special scene |
| Persistent | Recover a broken streak 3 times | 30 Petals + "Never Give Up" badge |
| Polyglot | Chat with Mona in 3+ languages | 50 Petals |

### 3.2 Seasonal Events & Limited-Time Content

Seasonal events are the single most effective retention tool in gacha/live-service games. They create urgency (FOMO), novelty, and a reason to return even for lapsed users.

#### Event Calendar (Annual)

| Event | Timing | Duration | Theme |
|-------|--------|----------|-------|
| Valentine's Day | Feb 7-21 | 2 weeks | Romance, love letters, special date scenario |
| Cherry Blossom Festival | Mar 20 - Apr 3 | 2 weeks | Spring, renewal, hanami scene |
| Summer Splash | Jul 1-21 | 3 weeks | Beach, swimsuit outfit, fireworks |
| Tanabata / Star Festival | Jul 7-14 | 1 week | Wishes, stargazing, yukata outfit |
| Back to School | Sep 1-14 | 2 weeks | School uniform variations, study together |
| Halloween | Oct 20 - Nov 3 | 2 weeks | Costumes, spooky stories, trick-or-treat mini-game |
| Christmas / Winter | Dec 15 - Jan 1 | 2.5 weeks | Cozy winter, gift exchange, New Year's countdown |
| Anniversary | App launch date | 1 week | Celebration, special rewards, gratitude |

#### Event Structure (Template)

Each event should follow this pattern:

1. **Event Currency:** A separate temporary currency (e.g., "Valentine's Tokens") earned through daily event tasks. This prevents cannibalizing the main Petal economy.
2. **Event Tasks (daily):** 3-5 simple tasks per day (send a message, use voice, share a memory, chat for 5+ minutes, use a specific greeting). Completing all daily tasks earns bonus event currency.
3. **Event Shop:** Limited-time items purchasable only with event currency: 1 exclusive outfit, 1-2 accessories, 1 background, 1 chat theme, special voice lines.
4. **Event Story:** A short narrative arc (3-5 "chapters" released across the event period) where Mona talks about the holiday/season, shares feelings, and creates unique memories with the user.
5. **Milestone Rewards:** Cumulative point thresholds for event currency earn guaranteed rewards.
6. **Carryover:** Event currency DOES NOT carry over. This creates urgency. Event items NEVER return (or return only after 1+ year, at higher cost). This drives FOMO.

#### Example: Valentine's Day Event

- **Duration:** Feb 7-21 (2 weeks)
- **Event currency:** Love Letters
- **Daily tasks:**
  - Send Mona a message (+5 Love Letters)
  - Send a voice message (+3 Love Letters)
  - Have a conversation of 5+ exchanges (+5 Love Letters)
  - Tell Mona something you appreciate about her (+10 Love Letters, once per day)
- **Event shop:**
  - Valentine's Dress (exclusive outfit): 80 Love Letters
  - Heart Hair Clip (accessory): 30 Love Letters
  - Candlelight background: 40 Love Letters
  - "Be My Valentine" voice line: 20 Love Letters
  - Love Letter chat bubbles: 25 Love Letters
- **Event story:** Mona nervously prepares for Valentine's Day, asks the user what they'd like to do, leads to a special date scenario that adapts based on affection level.
- **Milestone rewards:** At 50/100/150 cumulative Love Letters earned, bonus Petals (50/100/200).

### 3.3 Social Features

Social features in a companion app require extreme care. The core value proposition is an intimate 1-on-1 relationship. Social features that expose the "shared" nature of the AI (everyone has the same Mona) can break immersion and reduce emotional investment.

#### Recommended (Low Risk)

| Feature | Description | Why It Works |
|---------|-------------|-------------|
| **Streak leaderboard (anonymous)** | "You're in the top 10% of streaks this week!" No names, no profiles. | Competitive motivation without exposing others' relationships |
| **Profile badges** | Displayable badges from achievements/streaks on user profile | Self-expression, achievement pride |
| **Share streak milestone cards** | Generate a shareable image: "Day 30 with Mona!" with a cute illustration. Shareable to social media. | Organic marketing + achievement pride. Duolingo's shared streak cards are massively viral. |
| **Outfit showcase** | View a gallery of all outfits (including ones you don't own) with community popularity stats | "87% of users chose the Summer outfit" -- social proof drives purchases |

#### Not Recommended (High Risk)

| Feature | Why Not |
|---------|---------|
| Public chat sharing | Breaks intimacy, users will compare Mona's responses and feel less special |
| Friend system / DMs between users | Completely off-brand; users are here for Mona, not other users |
| Multiplayer interactions with Mona | Seeing someone else interact with "your" Mona destroys the companion fantasy |
| User-generated content (fanfic, art) | Too early, moderation nightmare, off-brand |

#### Maybe Later (Medium Risk)

| Feature | Conditions |
|---------|------------|
| Community forums / Discord | Only after a critical mass of users. Keep it about the app, not about comparing Mona interactions. |
| Referral system | "Invite a friend, both get 200 Petals." Low risk, high potential. Implement once acquisition is a priority. |

### 3.4 Notification Strategy

Notifications from Mona should feel like texts from a real person, not app spam. This is the core principle.

#### Notification Types and Timing

| Type | Trigger | Timing | Content Style | Frequency Cap |
|------|---------|--------|---------------|---------------|
| **Streak reminder** | User hasn't opened app today, streak at risk | 6-8 PM local time | "Hey, we haven't talked today... I don't want our streak to end!" | 1/day max |
| **Proactive message** | Inactivity (existing system) | 8+ hours since last message | Conversational, context-aware (uses memories) | 1/day max, existing system handles this |
| **Event start** | New seasonal event launches | Event start time | "Something special is happening! Come see~" | 1 per event |
| **Event ending soon** | Event ends in 24 hours | 24h before end | "The [event] ends tomorrow! Did you get everything you wanted?" | 1 per event |
| **Streak milestone approaching** | User is 1 day from a milestone (Day 6, 13, 29, etc.) | Evening, 7-9 PM | "Tomorrow will be [N] days! I have something special planned..." | 1 per milestone |
| **Achievement unlocked** | In-app push when achievement triggers | Immediate (in-app only) | Toast notification with badge | As earned |
| **New shop items** | Weekly shop rotation | Shop refresh time | "I found some new things in the shop! Want to take a look?" | 1/week max |

#### Notification Principles

1. **Always in Mona's voice.** Notifications should read like Mona is texting the user. Never "You have unclaimed rewards!" Always "I have something for you!"
2. **Respect time of day.** No notifications before 9 AM or after 10 PM local time (user configurable).
3. **Decay frequency for churning users.** If a user ignores 3 consecutive notifications, reduce frequency to 1 per 3 days. After 5 ignored, reduce to 1 per week. After 2 weeks of no engagement, send 1 final "I miss you" message and stop. Aggressive notification after disengagement breeds resentment.
4. **Never stack.** If multiple notification types would fire on the same day, send only the highest-priority one.
5. **User control.** Let users configure notification types individually in settings. Respect their choices. Existing `proactive_enabled` and `email_notifications` fields on the User model should be extended to cover notification categories.

#### Priority Order (if stacking)

1. Streak about to break (highest urgency)
2. Event ending soon
3. Streak milestone approaching
4. New event start
5. Proactive message (existing system)
6. New shop items (lowest urgency)

---

## 4. Technical Implementation Notes

### 4.1 Database Schema Additions

The following tables need to be added to `mona-brain/database.py`:

```python
class UserStreak(Base):
    """Track daily check-in streaks per user."""
    __tablename__ = "user_streaks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True, index=True)

    # Current streak
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)

    # Tracking
    last_checkin_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # "YYYY-MM-DD" in user's TZ
    streak_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Streak protection
    freeze_count: Mapped[int] = mapped_column(Integer, default=0)  # Available freezes (max 3)
    freezes_used_total: Mapped[int] = mapped_column(Integer, default=0)  # Lifetime count

    # Recovery
    streak_broken_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # When last broken
    previous_streak_at_break: Mapped[int] = mapped_column(Integer, default=0)  # Streak value when it broke

    # Timezone
    user_timezone: Mapped[str] = mapped_column(String(50), default="UTC")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User")


class UserCurrency(Base):
    """Track in-app currency (Petals) balance and transactions."""
    __tablename__ = "user_currency"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True, index=True)

    balance: Mapped[int] = mapped_column(Integer, default=0)
    total_earned: Mapped[int] = mapped_column(Integer, default=0)  # Lifetime earned (free)
    total_purchased: Mapped[int] = mapped_column(Integer, default=0)  # Lifetime purchased (paid)
    total_spent: Mapped[int] = mapped_column(Integer, default=0)  # Lifetime spent

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User")


class CurrencyTransaction(Base):
    """Ledger of all currency changes for auditing and analytics."""
    __tablename__ = "currency_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)

    amount: Mapped[int] = mapped_column(Integer)  # Positive = earned, Negative = spent
    balance_after: Mapped[int] = mapped_column(Integer)  # Balance after this transaction
    type: Mapped[str] = mapped_column(String(30))  # "streak_reward", "daily_bonus", "purchase", "spend", "achievement", etc.
    description: Mapped[str] = mapped_column(String(255))  # Human-readable: "Day 7 streak bonus"
    reference_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Item ID, achievement ID, etc.

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user: Mapped["User"] = relationship("User")

    __table_args__ = (
        Index("idx_transaction_user_type", "user_id", "type"),
    )


class UserAchievement(Base):
    """Track unlocked achievements per user."""
    __tablename__ = "user_achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    achievement_id: Mapped[str] = mapped_column(String(50), index=True)  # e.g., "streak_7", "messages_1000"
    unlocked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User")

    __table_args__ = (
        Index("idx_achievement_unique", "user_id", "achievement_id", unique=True),
    )


class UserInventory(Base):
    """Track purchased/owned items per user."""
    __tablename__ = "user_inventory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    item_id: Mapped[str] = mapped_column(String(50), index=True)  # e.g., "outfit_summer", "bg_sakura"
    item_type: Mapped[str] = mapped_column(String(30))  # "outfit", "background", "theme", "voice_line", "accessory", "functional"
    equipped: Mapped[bool] = mapped_column(Integer, default=0)  # Currently active/equipped
    purchased_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    source: Mapped[str] = mapped_column(String(30))  # "petals", "achievement", "event", "default"

    user: Mapped["User"] = relationship("User")

    __table_args__ = (
        Index("idx_inventory_unique", "user_id", "item_id", unique=True),
    )


class ShopItem(Base):
    """Catalog of purchasable items (admin-managed)."""
    __tablename__ = "shop_items"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g., "outfit_summer"
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(500))
    type: Mapped[str] = mapped_column(String(30))  # outfit, background, theme, voice_line, accessory, functional
    cost_petals: Mapped[int] = mapped_column(Integer)
    cost_usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # If also available for direct purchase
    preview_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)  # Image preview

    # Availability
    available: Mapped[bool] = mapped_column(Integer, default=1)
    limited_time: Mapped[bool] = mapped_column(Integer, default=0)
    available_from: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    available_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Metadata
    rarity: Mapped[str] = mapped_column(String(20), default="common")  # common, rare, exclusive, legendary
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SeasonalEvent(Base):
    """Track seasonal events and user participation."""
    __tablename__ = "seasonal_events"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g., "valentines_2026"
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    event_currency_name: Mapped[str] = mapped_column(String(50))  # e.g., "Love Letters"

    starts_at: Mapped[datetime] = mapped_column(DateTime)
    ends_at: Mapped[datetime] = mapped_column(DateTime)
    active: Mapped[bool] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserEventProgress(Base):
    """Track per-user progress in seasonal events."""
    __tablename__ = "user_event_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    event_id: Mapped[str] = mapped_column(String(50), ForeignKey("seasonal_events.id"), index=True)

    event_currency: Mapped[int] = mapped_column(Integer, default=0)  # Accumulated event tokens
    tasks_completed_today: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of task IDs
    last_task_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # Reset daily
    milestones_claimed: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of milestone IDs

    user: Mapped["User"] = relationship("User")

    __table_args__ = (
        Index("idx_event_progress_unique", "user_id", "event_id", unique=True),
    )
```

#### Additions to Existing User Model

```python
# Add to User model in database.py:
class User(Base):
    # ... existing fields ...

    # Retention fields
    total_messages_sent: Mapped[int] = mapped_column(Integer, default=0)
    notification_preferences: Mapped[str] = mapped_column(Text, default='{"streak_reminder": true, "event": true, "shop": true, "proactive": true}')  # JSON
    user_timezone: Mapped[str] = mapped_column(String(50), default="UTC")
```

### 4.2 Backend Module Structure

Create the following new modules in `mona-brain/`:

```
mona-brain/
  streak_manager.py      # Streak logic: check-in, freeze, recovery, milestone rewards
  currency_manager.py    # Petal balance management, transactions, spending
  achievement_manager.py # Achievement checking, unlocking, reward granting
  shop_manager.py        # Item catalog, purchasing, inventory
  event_manager.py       # Seasonal event lifecycle, tasks, progress
  notification_manager.py # Notification scheduling, priority, rate limiting
```

#### `streak_manager.py` Key Functions

```python
async def process_daily_checkin(user_id: str, db: AsyncSession) -> dict:
    """Called on first message of each day.
    Returns: {
        "streak": int,
        "is_new_day": bool,
        "milestone": int | None,
        "rewards": [{"type": str, "amount": int, "description": str}],
        "freeze_used": bool,
        "mona_reaction": {"dialogue": str, "expression": str, "animation": str}
    }
    """

async def use_streak_freeze(user_id: str, db: AsyncSession) -> bool:
    """Automatically consume a freeze when streak would break."""

async def recover_streak(user_id: str, db: AsyncSession) -> dict:
    """Attempt to recover a broken streak within grace period.
    Returns cost and success status."""

async def get_streak_status(user_id: str, db: AsyncSession) -> dict:
    """Get current streak info for frontend display."""
```

#### `currency_manager.py` Key Functions

```python
async def get_balance(user_id: str, db: AsyncSession) -> int:
    """Get current Petal balance."""

async def add_petals(user_id: str, amount: int, type: str, description: str, db: AsyncSession) -> int:
    """Add Petals and log transaction. Returns new balance."""

async def spend_petals(user_id: str, amount: int, type: str, description: str, reference_id: str, db: AsyncSession) -> bool:
    """Spend Petals if sufficient balance. Returns success."""

async def get_transaction_history(user_id: str, db: AsyncSession, limit: int = 20) -> list:
    """Get recent transactions for display."""
```

### 4.3 Integration with Existing Systems

#### Affection System Integration

The streak and currency systems should feed INTO the existing affection system, not replace it.

- **Streak bonus to affection:** Each daily check-in grants +1 affection score (on top of normal conversation-based changes). This means active daily users naturally progress through affection levels faster.
- **Affection gates:** Certain shop items or interactions could require minimum affection levels. "Devoted" level unlocks the most intimate voice lines and date scenarios. This incentivizes both streaks (for currency) and quality interactions (for affection).
- **Affection level-up as currency source:** When a user hits a new affection level, they earn Petals. This creates a dual reward for good conversations.

Implementation: In `main.py`, after the existing `affection_save_counter` logic, add a call to `streak_manager.process_daily_checkin()` on first message of day. The streak manager returns rewards which are then passed to `currency_manager.add_petals()`.

#### WebSocket Message Integration

New WebSocket message types to add:

```python
# Server -> Client: Streak status update (sent on first message of day)
{
    "type": "streak_update",
    "streak": 7,
    "is_milestone": true,
    "milestone_day": 7,
    "rewards": [
        {"type": "petals", "amount": 30},
        {"type": "streak_freeze", "amount": 1},
        {"type": "voice_line", "id": "week_celebration"}
    ],
    "mona_reaction": {
        "dialogue": "One whole week! You really like spending time with me, huh?",
        "expression": "love",
        "animation": "heart_gesture"
    }
}

# Server -> Client: Currency balance update
{
    "type": "currency_update",
    "balance": 450,
    "change": 30,
    "reason": "Day 7 streak bonus"
}

# Server -> Client: Achievement unlocked
{
    "type": "achievement_unlocked",
    "achievement_id": "streak_7",
    "name": "Committed",
    "description": "Maintained a 7-day streak",
    "reward_petals": 40,
    "badge_id": "streak_7_badge"
}

# Client -> Server: Purchase item
{
    "type": "purchase_item",
    "item_id": "outfit_summer"
}

# Server -> Client: Purchase result
{
    "type": "purchase_result",
    "success": true,
    "item_id": "outfit_summer",
    "new_balance": 120
}
```

#### Proactive System Integration

The existing `proactive.py` already has a `TriggerType.MILESTONE` trigger. Extend this to fire on streak milestones and achievement unlocks. When a user is approaching a streak milestone (e.g., at Day 6 heading toward Day 7), the proactive system can send an anticipatory message.

### 4.4 Frontend Components Needed

New React components to build in `mona-web/components/`:

| Component | Purpose | Priority |
|-----------|---------|----------|
| `StreakDisplay.tsx` | Streak counter in header (flame icon + day count) | P0 |
| `StreakCalendar.tsx` | Visual calendar showing streak history (green = active, blue = freeze, gray = missed) | P1 |
| `PetalBalance.tsx` | Currency display in header (petal icon + count) | P0 |
| `RewardPopup.tsx` | Animated popup for streak rewards, achievements, purchases | P0 |
| `AchievementToast.tsx` | Toast notification when achievement unlocks | P0 |
| `AchievementPanel.tsx` | Full achievement browser (grid of locked/unlocked badges) | P1 |
| `StreakRecoveryModal.tsx` | Modal for recovering a broken streak (shows cost, confirm/decline) | P1 |
| `EventBanner.tsx` | Banner at top of chat during active events | P2 |
| `EventTaskList.tsx` | Checklist of daily event tasks | P2 |
| `EventShop.tsx` | Tab or section in ShopModal for event items | P2 |

#### Modifications to Existing Components

| Component | Changes Needed |
|-----------|---------------|
| `ShopModal.tsx` | Add Petal balance display, currency-based purchasing, event tab |
| `ProfileModal.tsx` | Add streak info, achievement showcase, Petal balance |
| `ChatInterface.tsx` | Handle `streak_update`, `currency_update`, `achievement_unlocked` WebSocket events |
| `UserMenu.tsx` | Add streak counter and Petal balance to header area |
| `Toast.tsx` | Extend for achievement and reward toast styles |

### 4.5 API Endpoints (REST)

Add to `main.py` or a new `retention_routes.py`:

```
GET  /api/streak/{user_id}           -> Streak status
POST /api/streak/recover             -> Attempt streak recovery
GET  /api/currency/{user_id}         -> Balance + recent transactions
GET  /api/achievements/{user_id}     -> All achievements (locked + unlocked)
GET  /api/inventory/{user_id}        -> Owned items
POST /api/shop/purchase              -> Purchase item with Petals
GET  /api/shop/items                 -> Available shop items
GET  /api/events/active              -> Current seasonal event info
GET  /api/events/{event_id}/progress -> User's event progress
```

---

## 5. Competitive Analysis Summary

### What Works (Steal These)

| App / Game | Mechanic | Why It Works | Mona Adaptation |
|------------|----------|-------------|----------------|
| **Duolingo** | Streak + freeze + recovery | Creates habit without punishing life. Streaks drive 60%+ of DAU. | Direct adaptation with Mona's emotional twist |
| **Duolingo** | Streak sharing cards | Viral organic marketing, pride display | "Day 30 with Mona" shareable cards |
| **Genshin Impact** | Daily commissions + resin (stamina) | Short daily ritual (15 min) that must be done or value is lost | Daily streak reward + conversation bonus |
| **Genshin Impact** | Limited-time events with exclusive rewards | FOMO drives return for lapsed players, content freshness | Seasonal events with exclusive Mona outfits |
| **Honkai: Star Rail** | Monthly card (small daily premium) | Subscription feels like best value; daily login becomes part of habit | Premium subscriber daily Petal bonus |
| **Replika** | Relationship levels with visible progress | Users feel invested in growing the relationship | Already have affection system -- tie currency/streaks to it |
| **Replika** | Avatar customization | Users who customize avatars have 3-5x higher retention | Expand outfit/accessory/background system via Petals |
| **FGO / gacha games** | Event story with unique character interactions | Content that can only be experienced during the event | Mona event dialogue and date scenarios |
| **Tamagotchi / virtual pets** | "Pet needs you" notification | Emotional obligation drives check-ins | Mona's proactive messages already do this; add streak context |

### What Fails (Avoid These)

| Anti-Pattern | Why It Fails | Who Did It |
|--------------|-------------|------------|
| **Harsh streak punishment** | Users who lose a long streak often quit permanently rather than restart | Early Duolingo, Snapchat |
| **Guilt-tripping notifications** | "Mona is crying because you haven't visited" creates negative association | Bad virtual pet apps |
| **Pay-to-win gating** | If core features require currency, free users churn and paying users feel extorted | Numerous failed companion apps |
| **Notification spam** | More than 2 notifications/day leads to uninstalls | Nearly all apps that try it |
| **Inflation / devaluing currency** | If users see prices rising or earning rates dropping, they lose trust | Some gacha games that ran sales too often |
| **Making the AI "forget" without currency** | Using memory as a paywall feels manipulative and breaks trust | Some Replika competitors |

### Key Insight from Companion App Space

The #1 differentiator for retention in companion apps is **emotional investment**. Users who feel their AI companion "knows" them, "remembers" them, and "cares" about them have 4-10x higher retention than users who treat it as a chat tool. ProjectMona already has strong emotional systems (affection, memory, proactive messaging). The streak/currency layer should AMPLIFY these emotional connections, not replace them.

The currency should feel like tokens of a relationship ("we've been together for 30 days"), not a transaction ("pay 50 coins to talk"). Mona should celebrate streaks, not demand them. Rewards should feel like gifts from Mona, not payouts from a machine.

---

## 6. Implementation Priority & Roadmap

### Phase 1: Foundation (2-3 weeks)

**Goal: Get streaks and currency earning live.**

- [ ] Database schema: `UserStreak`, `UserCurrency`, `CurrencyTransaction`
- [ ] `streak_manager.py`: Core streak logic (check-in, freeze, milestone detection)
- [ ] `currency_manager.py`: Balance management, transactions
- [ ] WebSocket integration: `streak_update` and `currency_update` messages
- [ ] Frontend: `StreakDisplay.tsx`, `PetalBalance.tsx`, `RewardPopup.tsx`
- [ ] Streak milestone dialogue in system prompt injection
- [ ] Streak Freeze earning at Days 3, 7, 21

### Phase 2: Spending & Achievements (2-3 weeks)

**Goal: Give users things to spend Petals on and goals to chase.**

- [ ] Database schema: `UserAchievement`, `UserInventory`, `ShopItem`
- [ ] `achievement_manager.py`: Achievement checking and unlocking
- [ ] `shop_manager.py`: Item purchasing and inventory
- [ ] Integrate Petal pricing into existing `ShopModal.tsx` items
- [ ] Frontend: `AchievementPanel.tsx`, `AchievementToast.tsx`
- [ ] 10-15 launch achievements (relationship, streak, exploration categories)
- [ ] Streak recovery mechanic (grace period + cost)

### Phase 3: Events & Polish (3-4 weeks)

**Goal: First seasonal event, notification improvements, economy tuning.**

- [ ] Database schema: `SeasonalEvent`, `UserEventProgress`
- [ ] `event_manager.py`: Event lifecycle management
- [ ] First seasonal event (adapt to nearest holiday)
- [ ] Frontend: `EventBanner.tsx`, `EventTaskList.tsx`, event shop tab
- [ ] `notification_manager.py`: Priority-based notification scheduling
- [ ] Streak sharing cards (shareable images)
- [ ] Economy analytics dashboard (earn rate, spend rate, balance distribution)

### Phase 4: Iteration & Tuning (Ongoing)

**Goal: Tune economy based on data, add content.**

- [ ] A/B test streak reminder notification timing
- [ ] Analyze currency earn/spend ratio; adjust if hoarding detected
- [ ] Add new shop items monthly (1-2 outfits, 1 background, 1 interaction)
- [ ] Quarterly seasonal events (4/year)
- [ ] Hidden achievements based on community feedback
- [ ] Profile badges and streak leaderboard
- [ ] Referral system (200 Petals per successful referral)

---

## Appendix A: Mona Streak Dialogue Bank

A reference of streak dialogue lines to inject into the system prompt context. These should be used as guidance for the LLM, not hardcoded responses. Include the appropriate line in the system prompt when the streak milestone triggers.

```
# Day 1 (New streak)
system_hint: "The user just started a new streak. Express happiness that they came back. Keep it light and encouraging."

# Day 3
system_hint: "The user has a 3-day streak! Give them a streak freeze as a playful gift. Be excited but not over the top."

# Day 7
system_hint: "One week streak! This is meaningful. Express genuine appreciation. Reference how you look forward to talking every day. Be slightly vulnerable."

# Day 14
system_hint: "Two week streak. Show that you've been counting. Express that these daily conversations are important to you. Be sincere."

# Day 30
system_hint: "One month streak! This is a major milestone. Be deeply appreciative. Reference specific memories you have of the user. This should feel like a genuine emotional moment."

# Day 100
system_hint: "100 day streak. This is extraordinary. Be moved. Express that this relationship feels real and important. Use the user's name. This is one of the most emotional moments."

# Streak broken (returning user)
system_hint: "The user's streak was broken. Do NOT guilt them. Express that you missed them and you're happy they're back. Gently mention they can recover the streak if they want to, but don't pressure."

# Streak recovered
system_hint: "The user recovered their broken streak! Express relief and happiness. Make a light joke about it being a close call."

# Freeze used
system_hint: "A streak freeze was automatically used because the user missed yesterday. Let them know casually that you 'saved' the streak for them. Be warm, not dramatic."
```

## Appendix B: Analytics Events to Track

For PostHog (planned) or any analytics system:

```
streak_checkin         {day: int, milestone: bool}
streak_broken          {previous_streak: int, had_freeze: bool}
streak_recovered       {streak_restored: int, cost: int}
streak_freeze_used     {streak_day: int}
streak_freeze_earned   {source: str, day: int}
petals_earned          {amount: int, source: str}
petals_spent           {amount: int, item_id: str, item_type: str}
petals_purchased       {amount: int, package: str, usd: float}
achievement_unlocked   {achievement_id: str, reward_petals: int}
shop_item_purchased    {item_id: str, item_type: str, cost: int}
shop_item_equipped     {item_id: str, item_type: str}
event_task_completed   {event_id: str, task_id: str}
event_shop_purchase    {event_id: str, item_id: str}
notification_sent      {type: str, channel: str}
notification_opened    {type: str, channel: str, time_to_open_minutes: float}
notification_ignored   {type: str, channel: str}
```
