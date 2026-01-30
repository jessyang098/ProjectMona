# User Identity & Persistent Memory System

## Overview

This document describes the implementation of user identity awareness and persistent memory for Mona, enabling her to:
1. Know who she's talking to (name/nickname)
2. Maintain conversation context across devices
3. Remember important facts about users across server restarts

---

## Problem Statement

Before this implementation:
- Mona had no idea who she was talking to (no name awareness)
- Switching devices meant losing all conversation context
- Server restarts wiped all memories (stored only in-memory)
- The LLM couldn't reference past conversations or remembered facts

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│  (loads 25 messages for UI display)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       WebSocket Connect                          │
│                                                                  │
│  1. Authenticate user (JWT from cookie)                         │
│  2. Set llm_user_id = user.id (not client_id)                   │
│  3. Load user info → LLM (name/nickname)                        │
│  4. Load chat history → LLM context (20 messages)               │
│  5. Load memories → LLM memory manager                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      During Conversation                         │
│                                                                  │
│  1. User sends message                                          │
│  2. LLM processes with full context (identity + memories)       │
│  3. Memory manager extracts new facts from message              │
│  4. New memories saved to database                              │
│  5. Response generated with personalized system prompt          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. User Identity Injection

**File:** `personality.py`

The system prompt now includes user identity:

```python
def get_system_prompt(self, ..., user_name: str | None = None):
    if user_name:
        user_identity = f"Your partner's name is {user_name}."
    else:
        user_identity = "This is a guest user."
```

**Why:** Mona needs to know who she's talking to for personalized responses. Using the nickname (if set) or OAuth name makes conversations feel personal.

---

### 2. Cross-Device State Persistence

**File:** `main.py`

```python
# Use user.id for LLM state so it persists across devices/sessions
llm_user_id = user.id if user else client_id
```

**Before:** LLM state was keyed by `client_id` (random per connection)
**After:** LLM state is keyed by `user.id` (persistent across devices)

**Why:** When the same user logs in from a different browser/device, their conversation context, emotion state, and memories are all preserved because they're tied to their account ID, not the browser session.

---

### 3. User Info Storage in LLM

**File:** `llm.py`

```python
def set_user_info(self, user_id: str, name: str | None = None, nickname: str | None = None):
    self.user_info[user_id] = {
        "name": nickname or name,  # Prefer nickname
    }
    # Update system prompt if conversation exists
    if user_id in self.conversations:
        self._update_system_prompt(user_id)
```

**Why:** Stores user's preferred name so the LLM can use it in the system prompt. Prefers nickname over OAuth name since that's what the user wants to be called.

---

### 4. Conversation History Loading

**File:** `llm.py`

```python
def load_conversation_history(self, user_id: str, messages: list[dict]):
    conversation = self._get_or_create_conversation(user_id)
    recent_messages = messages[-self.max_history:]  # Last 20
    for msg in recent_messages:
        conversation.append(ConversationMessage(role=msg["role"], content=msg["content"]))
```

**Why:** When a user connects, their past conversation is loaded into the LLM's context window. This gives Mona awareness of recent exchanges. Limited to 20 messages to avoid context bloat.

**Note:** UI receives 25 messages, LLM gets 20. UI needs slightly more for scroll history; LLM needs less for efficiency.

---

### 5. Persistent Memory Database

**File:** `database.py`

```python
class UserMemory(Base):
    __tablename__ = "user_memories"

    id: int (primary key)
    user_id: str (FK to users.id)
    content: str          # "User's favorite food is pizza"
    category: str         # fact, preference, event, feeling, other
    importance: int       # 0-100 scale
    created_at: datetime
```

**Why:** Memories need to survive server restarts. SQLite stores them persistently. The `importance` field allows prioritizing which memories to load (most important first).

---

### 6. Memory Extraction & Persistence

**File:** `memory.py`

The `MemoryManager` extracts facts from user messages using regex patterns:

| Pattern | Category | Importance | Example |
|---------|----------|------------|---------|
| "my name is X" | fact | 90 | "my name is John" |
| "my favorite X is Y" | preference | 80 | "my favorite color is blue" |
| "i like X" | preference | 75 | "i like pizza" |
| "i'm feeling X" | feeling | 70 | "i'm feeling tired" |
| "i went/just" | event | 60 | "i just got back from work" |

**Persistence flow:**
```python
# In main.py after LLM response
pending_memories = mona_llm.get_pending_memories(llm_user_id)
for mem in pending_memories:
    await save_memory_to_db(db, user.id, mem)
```

**Why:**
- Extract important facts automatically (no manual tagging needed)
- `_pending_save` dict tracks new memories that haven't been saved yet
- `from_db=True` flag prevents re-saving when loading from database

---

### 7. Memory Loading on Connect

**File:** `main.py`

```python
if mona_llm:
    db_memories = await load_memories_from_db(db, user.id)
    if db_memories:
        mona_llm.load_memories(llm_user_id, db_memories)
```

**Why:** When user connects, their persisted memories are loaded into the in-memory cache. These get included in the system prompt's "RECENT MEMORIES" section.

---

## Data Flow Summary

### On User Connect:
```
1. JWT decoded → user.id
2. llm_user_id = user.id (not client_id)
3. set_user_info(llm_user_id, name, nickname)
4. Load 25 messages → send to frontend (UI history)
5. Load 20 messages → load_conversation_history() (LLM context)
6. Load memories → load_memories() (LLM memory)
```

### On Message Send:
```
1. User message received
2. LLM generates response (with identity + context + memories)
3. Memory manager extracts facts from user message
4. Save user message to DB
5. Save assistant response to DB
6. Save new memories to DB
```

---

## Key Design Decisions

### Why separate UI history (25) from LLM context (20)?
- UI needs enough messages for comfortable scrolling
- LLM context has token limits; fewer messages = faster responses
- Past messages beyond ~20 are unlikely to be directly relevant

### Why use `user.id` instead of `client_id`?
- `client_id` is random per WebSocket connection
- `user.id` is stable across devices/browsers
- Same user on different device = same conversation state

### Why in-memory cache + database?
- In-memory: Fast access during conversation
- Database: Persistence across restarts
- `_pending_save` tracks what needs syncing to avoid duplicates

### Why regex-based memory extraction?
- Simple, fast, no LLM calls needed
- Catches common patterns ("my name is", "i like")
- Low-importance fallback for unmatched messages
- Can be enhanced with LLM-based extraction later if needed

---

## Current Limitations (v1)

### What's Working
- ✅ Using `user.id` for LLM state (correct cross-device abstraction)
- ✅ Separating UI history (25) from LLM context (20) (token budgeting)
- ✅ DB-backed memory + in-memory cache (hybrid durability/speed)
- ✅ Memory categories + importance (foundation for retrieval)

### What Needs Improvement
- ❌ No deduplication (repeated "I like pizza" creates duplicates)
- ❌ No contradiction handling ("favorite is pizza" then "actually ramen")
- ❌ No TTL on ephemeral memories (feelings persist forever)
- ❌ Blind memory injection (dumps all memories regardless of relevance)
- ❌ No user controls (can't view/delete/disable memories)
- ❌ No multi-device conflict resolution

---

## Architecture Evolution: v1 → v2

### Three Subsystems (should have clear boundaries)

```
┌─────────────────────────────────────────────────────────────────┐
│  1. IDENTITY LAYER                                               │
│     Who is the user? What name should we use?                   │
│     • user.id, preferred_name, pronouns                         │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│  2. CONVERSATION STATE                                           │
│     Recent messages + rolling summary (token budget)            │
│     • Last 20 messages + summary of older context               │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│  3. MEMORY SYSTEM                                                │
│     Durable facts/preferences with lifecycle + retrieval        │
│     • Create → Update → Deprecate/Forget                        │
│     • Relevance-based injection (not global dump)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Improvement Roadmap

### 1. Memory Correctness: Deduplication & Updates

**Problem:** Regex creates near-duplicates and can't handle contradictions.

**Solution: Add memory keys + versioning**

```python
class UserMemory(Base):
    # ... existing fields ...

    # NEW FIELDS
    key: str              # e.g., "favorite_food", "name", "likes:pizza"
    value: str            # normalized value
    raw_content: str      # original phrasing
    confidence: float     # 0.0-1.0 (regex = 0.7, LLM = 0.9, user-confirmed = 1.0)
    status: str           # "active", "deprecated"
    supersedes_id: int    # FK to previous memory (nullable)
    expires_at: datetime  # TTL for ephemeral memories (nullable)
    last_used_at: datetime # update when retrieved
    source_message_id: int # where it came from
```

**Deduplication rules:**
1. Normalize content (lowercase, strip punctuation)
2. If same `key` exists with similar `value` → bump importance, don't insert
3. If same `key` exists with different `value` → deprecate old, insert new, link via `supersedes_id`

**Confidence scoring:**
| Source | Confidence |
|--------|------------|
| "my name is X" | 0.9 |
| "my favorite X is Y" | 0.8 |
| "i like X" | 0.7 |
| "i'm feeling X" | 0.5 |
| User-confirmed | 1.0 |
| LLM-extracted | 0.85 |

---

### 2. Memory Lifecycle: TTL for Ephemeral Data

**Problem:** "I'm feeling tired" persists forever, causing stale behavior.

**Solution: Split durable vs ephemeral**

| Category | Type | TTL | Example |
|----------|------|-----|---------|
| fact | durable | none | "User's name is John" |
| preference | durable | none (can be overwritten) | "Favorite food is pizza" |
| event | ephemeral | 7 days | "Just got back from vacation" |
| feeling | ephemeral | 6 hours | "Feeling tired" |

**Implementation:**
```python
def get_ttl_for_category(category: MemoryCategory) -> timedelta | None:
    return {
        MemoryCategory.FACT: None,
        MemoryCategory.PREFERENCE: None,
        MemoryCategory.EVENT: timedelta(days=7),
        MemoryCategory.FEELING: timedelta(hours=6),
        MemoryCategory.OTHER: timedelta(days=1),
    }.get(category)
```

---

### 3. Relevance-Based Retrieval (Don't Dump All Memories)

**Problem:** Stuffing all memories into prompt causes token bloat and irrelevant steering.

**Solution: Two-tier injection**

**Tier 1: Always inject (tiny, stable)**
- Name / pronouns
- Core preferences (top 3-5 by importance)

**Tier 2: Query-based inject (relevant to current message)**
- Keyword overlap scoring
- Boost if recently confirmed/used
- Top-K (e.g., 5) most relevant to current turn

**v1 Relevance Scoring (no embeddings):**
```python
def score_memory_relevance(memory: MemoryItem, user_message: str) -> float:
    message_words = set(user_message.lower().split())
    memory_words = set(memory.content.lower().split())

    overlap = len(message_words & memory_words)
    recency_boost = 0.1 if memory.last_used_at and (now - memory.last_used_at).days < 7 else 0

    return (overlap * 0.3) + (memory.importance / 100 * 0.5) + recency_boost
```

**v2: Embedding-based retrieval** (later)
- Store embedding per memory
- Cosine similarity for retrieval
- Much better relevance without keyword brittleness

---

### 4. Deterministic Prompt Construction

**Problem:** Updating system prompt in-place causes drift and debugging issues.

**Solution: Pure function for prompt assembly**

```python
def render_system_prompt(
    user_id: str,
    user_info: UserInfo,
    conversation_summary: str | None,
    retrieved_memories: list[MemoryItem],
    emotion_state: str,
    relationship_stage: str,
) -> str:
    """Pure function - no side effects, fully deterministic."""
    ...
```

**Benefits:**
- Easier debugging (same inputs = same output)
- Easier A/B testing
- No risk of prompt drift from "update if exists" logic

---

### 5. Multi-Device Concurrency

**Problem:** Two devices writing simultaneously can cause duplicates or conflicts.

**Solution: DB as source of truth + idempotency**

1. **Unique constraint:** `(user_id, key, source_message_id)`
2. **Conflict policy for same key:**
   - Last-write-wins based on message timestamp
   - OR prefer higher confidence
   - OR ask user: "Earlier you said X, now Y—should I update?"

3. **Remove `_pending_save` as truth:**
   - Treat as buffer only
   - Write to DB immediately with conflict handling
   - In-memory cache syncs from DB

---

### 6. User Privacy & Controls

**Required features:**
- "What do you remember about me?" → list all active memories
- "Forget that" / "Don't remember this" → delete specific memory
- "Forget everything about X" → delete by key/category
- Settings: enable/disable memory, allowed categories, retention duration
- Export / delete all (GDPR compliance)

**Safety rules:**
- Never store: passwords, SSNs, financial details
- Filter patterns for sensitive content
- Encrypt at rest if moving beyond SQLite

---

### 7. Conversation Summarization

**Strategy:**
- Keep last N messages (e.g., 20) verbatim
- Maintain rolling summary updated every M turns
- Summary stored in DB per user
- On connect: inject summary + recent messages

```python
class ConversationSummary(Base):
    user_id: str
    summary: str           # "User talked about work stress, mentioned upcoming trip..."
    messages_covered: int  # how many messages this summarizes
    updated_at: datetime
```

---

### 8. Safer Regex Extraction

**Current problem:** Casual statements become "facts"

**Improvements:**

**Add negative patterns (don't extract if present):**
- "I might", "maybe", "thinking about", "if", "would", "could"
- Questions: "Do you think I like...?"

**Require explicit ownership:**
- Must have "my", "I", "I'm"
- "Pizza is great" ≠ preference
- "My favorite pizza is pepperoni" = preference

**Example safeguard:**
```python
UNCERTAIN_PATTERNS = [
    r"\b(might|maybe|probably|thinking about|could|would|if)\b",
    r"\?$",  # questions
]

def is_uncertain(message: str) -> bool:
    return any(re.search(p, message, re.I) for p in UNCERTAIN_PATTERNS)
```

---

## v1.5 Upgrade Plan (Fast Wins)

| Priority | Change | Effort |
|----------|--------|--------|
| 1 | Add `key`, `status`, `expires_at`, `confidence`, `source_message_id` to UserMemory | Low |
| 2 | Implement dedupe + update for key-based memories | Medium |
| 3 | Implement TTL for feelings/events | Low |
| 4 | Add relevance scoring (keyword-based) for memory injection | Medium |
| 5 | Add user commands: view/delete/disable memory | Medium |
| 6 | Add negative patterns to regex extraction | Low |

---

## Testing Verification

### v1 (Current)
1. **User Identity**: Log in, send message, verify Mona knows your name
2. **Cross-Device**: Log in on different browser, verify context preserved
3. **Memory Persistence**: Tell Mona "my favorite food is pizza" → restart → ask "what's my favorite food?"

### v1.5 (After Improvements)
4. **Deduplication**: Say "I like pizza" twice → verify only 1 memory stored
5. **Updates**: Say "my favorite is pizza" then "actually it's ramen" → verify ramen is active, pizza deprecated
6. **TTL**: Say "I'm feeling tired" → wait 6+ hours → verify not in prompt
7. **Relevance**: Ask about food → verify food-related memories injected, not work memories
8. **User control**: Say "what do you remember?" → verify list; say "forget X" → verify deleted
