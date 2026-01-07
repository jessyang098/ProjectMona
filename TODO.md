# Project Mona - TODO

## Critical Next Steps

### 1. Discord OAuth Setup ✅ COMPLETE
- [x] Discord app created (Client ID: 1457044242256887900)
- [x] Discord redirect URL: `https://9s1a5iczgbjaem-8888.proxy.runpod.net/auth/discord/callback`
- [x] `.env` configured on RunPod
- [x] Backend running on port 8888
- [x] Vercel env updated: `NEXT_PUBLIC_BACKEND_URL=https://9s1a5iczgbjaem-8888.proxy.runpod.net`
- [x] Discord login flow working

### 2. Fix GPT-SoVITS Startup
- [ ] Run: `pip uninstall peft transformers -y && pip install --no-cache-dir peft==0.12.0 transformers==4.44.0`
- [ ] Run: `python -c "import nltk; nltk.download('averaged_perceptron_tagger_eng')"`
- [ ] Restart GPT-SoVITS server

### 3. Memory Persistence (After auth works)
- [ ] Add `Memory` table to SQLite database
- [ ] Persist extracted memories (name, preferences, events)
- [ ] Load memories on user connect

---

## Memory Persistence

Currently, Mona's memory system has a gap:
- **Chat history** is persisted to SQLite (survives restarts)
- **Extracted memories** are in-memory only (lost on restart)

### Options to Fix

#### Option 1: Re-process History on Connect (Simplest)
When a user connects, re-extract memories from their saved chat history:
```python
for message in user.messages:
    if message.role == "user":
        memory_manager.process_user_message(user.id, message.content)
```
- Pros: No new database table needed
- Cons: Slight delay on connect, regex-based extraction is limited

#### Option 2: Persist Memories to Database (Recommended)
Add a `Memory` table to store extracted facts permanently:
```python
class Memory(Base):
    __tablename__ = "memories"
    id: Mapped[int]
    user_id: Mapped[str]  # FK to users
    content: Mapped[str]  # "User's name is Alex"
    category: Mapped[str]  # fact, preference, event
    importance: Mapped[int]
    created_at: Mapped[datetime]
```
- Pros: Fast load, survives restarts, can be manually edited
- Cons: More code, need migration

#### Option 3: LLM-Based Memory Extraction (Most Intelligent)
Have the LLM extract and summarize important facts after each conversation:
```python
prompt = f"Extract key facts about the user from this conversation: {messages}"
new_memories = llm.extract_memories(prompt)
```
- Pros: Much smarter extraction than regex
- Cons: Extra API calls, cost

---

## Authentication

### Completed
- [x] Google OAuth flow
- [x] Discord OAuth flow
- [x] JWT authentication
- [x] Guest message limit (10)
- [x] Login prompt on limit
- [x] Manual login button in header

### Needs Configuration
Set these environment variables to activate:
```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback

# Discord OAuth
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:8000/auth/discord/callback

# Frontend
FRONTEND_URL=http://localhost:3000
```

---

## Expressions & Animations

### Available Test Commands

#### Expression Commands (`test:expr:<name>`)
- `test:expr:neutral` - Neutral face
- `test:expr:happy` - Happy/smiling
- `test:expr:angry` - Angry
- `test:expr:sad` - Sad
- `test:expr:relaxed` - Relaxed
- `test:expr:special` - Special/blush
- `test:expr:cheekpuff` - Cheek puff
- `test:expr:clear` - Clear all expressions

#### Pose Commands (`test:<name>`)
- `test:wave` - Wave goodbye
- `test:idle` - Standing idle (looping)
- `test:default` - Default pose (hold)
- `test:crouch` - Crouch pose (hold)
- `test:lay` - Laying pose (hold)
- `test:stand` - Stand pose (hold)
- `test:stand1` - Stand pose variant (hold)
- `test:rest` / `test:stop` - Return to idle

### Missing Animations
- Clapping.vrma (using Surprised as fallback)
- Jump.vrma (using Surprised as fallback)
- Blush.vrma (using Sleepy as fallback)
- Angry.vrma (using Sad as fallback)

---

## Avatar Credits

| Avatar | Original Name | Creator | Source | License |
|--------|---------------|---------|--------|---------|
| Hana | Higanbana | [Creator Name] | [VRoid Hub](https://hub.vroid.com/) | Attribution required |
| Tora | Toraka | [Creator Name] | [VRoid Hub](https://hub.vroid.com/) | Attribution required |
| Moe | Moe | [Creator Name] | [Source] | [License] |

*Note: Update creator names and links with actual attribution info.*

---

## Future Ideas
- [ ] Voice input (speech-to-text)
- [ ] Multiple avatar support
- [ ] Custom avatar upload
- [ ] Affection/relationship system UI
- [ ] Mobile app wrapper
