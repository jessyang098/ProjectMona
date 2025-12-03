# Project Mona

An AI companion who lives inside a beautifully animated 3D world. She talks, listens, remembers, expresses emotions, and grows a relationship with the user over time.

## Overview

Mona is more than a chatbot — she is a persistent, emotionally responsive character with customizable appearances, rooms, and personalities. Users interact with Mona through text, voice, and a fully animated 3D avatar.

## Current Status: Week 5 In Progress

### Week 5 Scope
- **Animation System**: Mixamo gesture loading and lip sync utilities
- **Voice Stack**: Speech recognition (ASR) and text-to-speech (TTS)
- **Audio Integration**: Real-time lip sync with audio playback

### Implemented Features

#### Week 1 ✓
- **WebSocket Chat System**: Real-time bidirectional communication
- **Chat UI**: Beautiful, responsive interface with message history
- **Typing Indicators**: Visual feedback when Mona is responding
- **Connection Management**: Automatic reconnection handling
- **Message Timestamps**: Track conversation history

#### Week 2 ✓
- **GPT-4 Integration**: Real AI conversations powered by OpenAI
- **Personality System**: Consistent character traits and speaking style
- **Emotion Engine**: Dynamic emotional responses (happy, excited, embarrassed, etc.)
- **Conversation Memory**: Maintains context across messages
- **Fallback Mode**: Works with or without API key

#### Week 3 ✓
- **Long-Term Memory Seeds**: Lightweight memory extraction from conversations for better callbacks
- **Affection System**: Relationship score that nudges Mona's warmth and tone
- **Consistent Behavior Rules**: System prompts now inject memory + affection context for stability

#### Week 4 ✓
- **Holographic Avatar Panel**: Real-time WebGL room that mirrors Mona's emotion stream
- **VRM Avatar Rendering**: Full 3D avatar with emotion-driven facial expressions
- **Procedural Idle Animations**: Natural blinking, head movement, and breathing
- **Streaming Responses**: WebSocket channel streams GPT tokens for faster perceived replies
- **Emotion-Driven Expressions**: Avatar reacts to conversation context in real-time

## Project Structure

```
ProjectMona/
├── mona-brain/          # FastAPI backend
│   ├── main.py          # WebSocket server & routing
│   ├── llm.py           # OpenAI GPT integration
│   ├── personality.py   # Mona's personality system
│   ├── emotion.py       # Emotion engine
│   ├── memory.py        # Conversation memory extraction/store
│   ├── affection.py     # Relationship tracker
│   ├── requirements.txt # Python dependencies
│   └── README.md        # Backend documentation
│
└── mona-web/            # Next.js frontend
    ├── app/             # Next.js app directory
    ├── components/      # React components
    ├── hooks/           # Custom React hooks
    ├── types/           # TypeScript definitions
    └── README.md        # Frontend documentation

🔧 **Prototype assets (temporary)**
- `mona-brain/personality.mona.yaml` – persona config loaded by default
- `mona-brain/assets/mona_voice/main_sample.wav` – sample voice clip for future SoVITS/TTS tests
- `mona-web/public/avatars/Mona1.vrm` – placeholder VRM served to the hologram panel
```

## Quick Start

### 1. Start the Backend (mona-brain)

```bash
cd mona-brain
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env file and add your OpenAI API key
cp .env.example .env
# Edit .env and set OPENAI_API_KEY=your_key_here

python main.py
```

Backend will run on [http://localhost:8000](http://localhost:8000)

**Note:** Get your OpenAI API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Without an API key, Mona will run in dummy mode. By default she loads the persona from `mona-brain/personality.mona.yaml`; set `PERSONALITY_CONFIG_PATH=/path/to/personality.yaml` to point to your own.

### 2. Start the Frontend (mona-web)

```bash
cd mona-web
npm install
npm run dev
```

Frontend will run on [http://localhost:3000](http://localhost:3000). A temporary VRM (`/avatars/Mona1.vrm`) is bundled for quick testing—override it by setting `NEXT_PUBLIC_VRM_URL` to your own `.vrm` file.

## Technology Stack

### Frontend (mona-web)
- Next.js 15 + TypeScript
- Tailwind CSS
- WebSocket API
- React Hooks
- Three.js + react-three-fiber (3D rendering)
- @pixiv/three-vrm (VRM avatar support)
- Web Audio API (lip sync analysis)

### Backend (mona-brain)
- FastAPI (Python)
- OpenAI GPT-4o-mini
- WebSockets
- Async/await patterns
- Pydantic for data validation

## Development Roadmap

- [x] **Week 1** – Core chat loop (WebSocket, UI, dummy Mona)
- [x] **Week 2** – LLM + persona + emotion engine
- [x] **Week 3** – Memory + affection + consistent behavior
- [x] **Week 4** – VRM avatar + procedural idle animations + emotion expressions
- [ ] **Week 5** – Voice stack (ASR + TTS) + lip sync + gesture animations
- [ ] **Week 6** – Cosmetics pipeline + personality YAML packs + launch scripts
- [ ] **Month 2+** – Mobile app, LiveOps, content drops, emotion-aware TTS filters

## Core Features

### 1. Personality & Emotion Engine ✓
- Consistent character voice with GPT system prompts
- Multi-dimensional emotion state (happy, excited, concerned, embarrassed, etc.)
- Dynamic emotion tracking based on conversation context
- Emotion data prepared for future 3D avatar expressions

### 2. Memory & Persistence
- Long-term semantic memory (pgvector/FAISS)
- Episodic & emotional memory
- User profile learning

### 3. 3D Avatar & Room
- VRM/glTF anime-style avatar
- Blendshape-based facial animation
- Fully rendered customizable rooms

### 4. Real-Time Voice
- Speech recognition
- Emotional TTS
- Mouth syncing

### 5. Cosmetics & Monetization
- Avatar skins
- Voice packs
- Personality packs
- Room skins
- Seasonal events

## Contributing

This is an active development project. Each week brings new features following the roadmap above.

## License

MIT License (to be added)
