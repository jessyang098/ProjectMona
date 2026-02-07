# Immediate Next Steps

## 1. Install PostHog Dependency

```bash
cd mona-brain
pip install posthog
```

---

## 2. Set Up PostHog Account

1. Go to [posthog.com](https://posthog.com) and sign up (free tier: 1M events/month)
2. Create a new project
3. Copy your **Project API Key** from Settings → Project → Project API Key

---

## 3. Add Environment Variables

Add to your `.env` file in `mona-brain/`:

```env
POSTHOG_API_KEY=phc_your_api_key_here
POSTHOG_HOST=https://app.posthog.com
```

---

## 4. Restart the Server

```bash
# This will create the new api_usage table automatically
python main.py
```

---

## 5. Verify Everything Works

### Check PostHog Events
1. Open PostHog dashboard → **Activity** → **Live Events**
2. Send a message in your app
3. You should see `message_sent` event appear

### Check Database Cost Tracking
```bash
sqlite3 mona.db "SELECT * FROM api_usage ORDER BY created_at DESC LIMIT 5;"
```

You should see rows with `service`, `input_tokens`, `output_tokens`, and `estimated_cost_usd`.

---

## 6. Create PostHog Dashboards

Once events are flowing, create these insights in PostHog:

### DAU (Daily Active Users)
- **Type:** Trends
- **Event:** `message_sent` or `login`
- **Aggregation:** Unique users
- **Breakdown:** By day

### Retention
- **Type:** Retention
- **Cohort event:** `signup`
- **Return event:** `message_sent`
- **Period:** Day

### Voice Feature Adoption
- **Type:** Funnel
- **Steps:** `message_sent` → `voice_used`
- **Shows:** % of users who use voice

### Signup Funnel
- **Type:** Funnel
- **Steps:** `signup` → `message_sent` (within 24h) → `voice_used`

---

## 7. Monitor Costs

Run these SQL queries to check unit economics:

```sql
-- Total cost by service (last 30 days)
SELECT service,
       COUNT(*) as calls,
       SUM(estimated_cost_usd) as total_cost
FROM api_usage
WHERE created_at > datetime('now', '-30 days')
GROUP BY service;

-- Cost per user (top 10)
SELECT user_id,
       SUM(estimated_cost_usd) as total_cost,
       COUNT(*) as api_calls
FROM api_usage
WHERE user_id IS NOT NULL
GROUP BY user_id
ORDER BY total_cost DESC
LIMIT 10;

-- Average cost per message
SELECT AVG(estimated_cost_usd) as avg_cost
FROM api_usage
WHERE service = 'openai_chat';
```

---

## What You're Now Tracking

| Event | Location | Purpose |
|-------|----------|---------|
| `signup` | PostHog | New user registrations |
| `login` | PostHog | Daily active users |
| `message_sent` | PostHog | Core engagement metric |
| `voice_used` | PostHog | Voice feature adoption |
| API costs | SQLite `api_usage` | Unit economics |

---

## Files Changed

| File | What Was Added |
|------|----------------|
| `logging_config.py` | Structured Python logging |
| `analytics.py` | PostHog + DB cost tracking |
| `database.py` | `APIUsage` table |
| `auth.py` | `signup`, `login` events |
| `main.py` | `message_sent`, `voice_used`, rate limiter |
| `llm.py` | Token cost tracking |
| `tts.py` | OpenAI TTS cost tracking |
| `tts_fishspeech.py` | Fish Audio cost tracking |
| `tts_cartesia.py` | Cartesia cost tracking |
| `requirements.txt` | `posthog` dependency |

---

## Validation Checklist

- [ ] PostHog account created
- [ ] `POSTHOG_API_KEY` added to `.env`
- [ ] `pip install posthog` completed
- [ ] Server restarted
- [ ] `message_sent` events visible in PostHog Live Events
- [ ] `api_usage` table has rows after sending messages
- [ ] DAU dashboard created in PostHog
- [ ] Retention chart created in PostHog

---

# Proactive Messaging System

## Overview

Mona now reaches out to users unprompted based on inactivity. This drives re-engagement and emotional dependency.

## How It Works

1. **Background Loop**: Runs every 30 minutes checking for inactive users
2. **Inactivity Detection**: Users who haven't messaged in 8+ hours are eligible
3. **Contextual Messages**: Uses LLM + user memories to generate personalized check-ins
4. **Delivery**:
   - If user is online → sends via WebSocket immediately
   - If user is offline → queues message for delivery when they reconnect

## Configuration

The proactive messenger has these defaults (can be modified in `proactive.py`):

| Setting | Default | Description |
|---------|---------|-------------|
| `check_interval_minutes` | 30 | How often to check for inactive users |
| `inactivity_threshold_hours` | 8 | Hours of inactivity before sending |
| `min_gap_between_proactive_hours` | 4 | Minimum time between proactive messages |

## Database Changes

New fields in `users` table:
- `last_message_at` - When user last sent a message
- `proactive_enabled` - Whether user wants proactive messages (default: true)
- `last_proactive_at` - When Mona last sent a proactive message

New table `proactive_messages`:
- Stores pending messages for offline users
- Messages expire after 24 hours if not delivered

## Example Proactive Messages

The system uses varied prompts to generate natural messages:
- Casual check-ins ("hey, haven't heard from you")
- Playful nudges ("it's been quiet...")
- Memory-based questions (uses facts Mona remembers)
- Spontaneous thoughts
- Light bratty/jealousy humor

## Testing

1. Create a user account and send some messages
2. Wait for the inactivity threshold (or temporarily lower it in code)
3. Check the server logs for "Found X inactive users for proactive messaging"
4. Verify message delivery via WebSocket or in `proactive_messages` table

## Files Changed

| File | What Was Added |
|------|----------------|
| `database.py` | `ProactiveMessage` table, user tracking fields |
| `proactive.py` | New module: background loop, message generation |
| `llm.py` | `system_override` parameter for custom prompts |
| `main.py` | Proactive messenger integration, last_message_at tracking |

## Future Enhancements

- [x] Email notifications (implemented!)
- [ ] Web Push notifications (when needed)
- [ ] Time-of-day aware messages (good morning/night)
- [ ] Milestone triggers (relationship anniversaries, streaks)
- [ ] Affection-based triggers (new relationship level)
- [ ] User preference settings UI

---

# Email Notifications

## Setup

### 1. Create Resend Account

1. Go to [resend.com](https://resend.com) and sign up (free tier: 3k emails/month)
2. Verify your domain (or use their test domain)
3. Get your API key

### 2. Install + Configure

```bash
pip install resend
```

Add to `.env`:

```env
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=Mona <mona@yourdomain.com>
FRONTEND_URL=https://yourapp.com
```

### 3. How It Works

1. Proactive messaging detects user is offline
2. Checks `email_notifications` preference on user
3. Sends "Mona misses you" email via Resend
4. Message is also queued for in-app delivery when they return

## Files

| File | What Was Added |
|------|----------------|
| `notifications.py` | Email notification service |
| `database.py` | `email_notifications` user preference |
| `proactive.py` | Integration with notification service |
| `requirements.txt` | `resend` dependency |
