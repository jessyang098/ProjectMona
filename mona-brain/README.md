# Mona Brain - Backend

FastAPI backend for Project Mona with GPT-powered personality and emotion engine.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file and add your OpenAI API key:
```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

**Important:** Get your OpenAI API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

## Running

```bash
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

- `GET /` - API status
- `GET /health` - Health check with connection count
- `WebSocket /ws/{client_id}` - WebSocket connection for real-time chat

## Architecture

```
mona-brain/
├── main.py          # FastAPI server & WebSocket handler
├── llm.py           # OpenAI GPT integration & conversation management
├── personality.py   # Mona's personality system & prompts
├── emotion.py       # Emotion engine & state tracking
├── memory.py        # Long-term memory extraction + storage
├── affection.py     # Relationship/affection tracker
└── requirements.txt # Python dependencies
```

## Features

### Week 1 ✓
- WebSocket server for real-time communication
- Connection management
- Typing indicators
- CORS support for Next.js frontend

### Week 2 ✓
- **GPT-4 Integration**: Real AI conversations powered by OpenAI
- **Personality System**: Consistent character traits and speaking style
- **Emotion Engine**: Dynamic emotional responses based on context
- **Conversation History**: Maintains context across messages
- **Fallback Mode**: Works without API key in dummy mode

### Week 3 ✓
- **Memory Seeds**: Extracts lightweight facts/preferences from chats for better callbacks
- **Affection Tracking**: Relationship score influences tone and warmth
- **Consistency Layer**: System prompt now receives memory + affection context

### Week 4 (In Progress)
- **Streaming Responses**: WebSocket channel streams GPT tokens chunk-by-chunk
- **YAML Personality Presets**: Point `PERSONALITY_CONFIG_PATH` at a config to override traits without code changes
- **Placeholder Assets**: Bundled `personality.mona.yaml` + voice sample for quick experiments

## How It Works

1. **Personality System** ([personality.py](personality.py))
   - Defines Mona's core traits (cheerful, caring, playful, curious, etc.)
   - Generates dynamic system prompts based on emotional state
   - Configurable personality parameters

2. **Emotion Engine** ([emotion.py](emotion.py))
   - Analyzes user messages for emotional context
   - Updates Mona's emotional state (happy, excited, concerned, embarrassed, etc.)
   - Tracks emotion history for consistency
   - Prepares emotion data for future 3D avatar expressions

3. **LLM Integration** ([llm.py](llm.py))
   - Manages OpenAI GPT API calls
   - Maintains per-user conversation history
   - Integrates emotion, memory, and affection state into responses
   - Supports streaming responses for faster perceived latency
   - Handles errors gracefully

4. **Memory & Affection Systems** ([memory.py](memory.py), [affection.py](affection.py))
   - Extract key preferences/facts from user messages via heuristics
   - Store capped, recent memories for prompt injection
   - Track affection score/level and describe it for the LLM

5. **WebSocket Server** ([main.py](main.py))
   - Real-time bidirectional communication
   - Automatic fallback to dummy mode if no API key
   - Connection management
   - Message routing

📁 **Prototype extras**: `personality.mona.yaml` auto-loads if present, and `assets/mona_voice/main_sample.wav` is reserved for the upcoming voice pipeline.

## Configuration

Edit `.env` to customize:
- `OPENAI_API_KEY` - Your OpenAI API key (required for GPT mode)
- `GPT_MODEL` - Model to use (default: gpt-4o-mini for cost-effectiveness)
- `MAX_CONVERSATION_HISTORY` - Number of messages to keep in context
- `PERSONALITY_CONFIG_PATH` - Optional path to a YAML file that overrides Mona's default persona

## Testing

Without API key (dummy mode):
```bash
python main.py
# Will show: "⚠ Running in DUMMY mode"
```

With API key (GPT mode):
```bash
# Add OPENAI_API_KEY to .env first
python main.py
# Will show: "✓ Mona LLM initialized with GPT"
```
