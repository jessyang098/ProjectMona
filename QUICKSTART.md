# Quick Start Guide

Get Mona running in minutes!

## First Time Setup

### 1. Install Backend Dependencies

```bash
cd mona-brain
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set up your OpenAI API key
cp .env.example .env
# Edit .env and add: OPENAI_API_KEY=your_key_here
```

### 2. Install Frontend Dependencies

```bash
cd mona-web
npm install
```

### 3. Install GPT-SoVITS (Optional - for Anime Voice)

```bash
cd /Users/vevocube/Desktop/ProjectMona
./setup-sovits.sh
```

Then download the pretrained models:
- Visit: https://github.com/RVC-Boss/GPT-SoVITS#pretrained-models
- Download GPT and SoVITS weights
- Place in: `gpt-sovits/pretrained_models/`

## Running Mona

### Option 1: Easy Start (Recommended)

```bash
./start-mona.sh
```

This automatically starts:
- 🎤 GPT-SoVITS server (anime voice)
- 🧠 Backend server
- 🌐 Frontend

Then open: http://localhost:3000

### Option 2: Manual Start

**Terminal 1 - Voice (Optional):**
```bash
cd gpt-sovits
source venv_sovits/bin/activate
python api.py
```

**Terminal 2 - Backend:**
```bash
cd mona-brain
source venv/bin/activate
python main.py
```

**Terminal 3 - Frontend:**
```bash
cd mona-web
npm run dev
```

Then open: http://localhost:3000

## What You'll See

✅ Chat interface with Mona
✅ 3D VRM avatar with emotions
✅ Real-time lip sync when she speaks
✅ Gesture animations (after downloading Mixamo files)
✅ Voice input (click microphone icon)
✅ Voice output (Riko's anime voice if SoVITS is running)

## Download Gesture Animations

Mona needs 8 animation files from Mixamo:

1. Visit https://www.mixamo.com/ (free Adobe account)
2. Download with settings:
   - Format: FBX for Unity
   - Skin: Without Skin ⚠️
   - Frame rate: 30
3. Save to: `mona-web/public/animations/`

Required files:
- wave.fbx
- excited.fbx
- thinking.fbx
- looking_around.fbx
- shy.fbx
- dismissing.fbx
- sad_idle.fbx
- standing_idle.fbx

See [mona-web/GESTURES.md](mona-web/GESTURES.md) for detailed instructions.

## Troubleshooting

### "No OpenAI API key"
- Get key from: https://platform.openai.com/api-keys
- Add to `mona-brain/.env`: `OPENAI_API_KEY=sk-...`

### "SoVITS not found"
- Run: `./setup-sovits.sh`
- Download pretrained models
- Or skip and use OpenAI TTS fallback

### "Port already in use"
- Stop other services on ports 3000, 8000, or 9880
- Or modify ports in config files

### Frontend won't connect
- Ensure backend is running (check port 8000)
- Check browser console for errors
- Verify WebSocket connection

## Next Steps

- Customize personality: Edit `mona-brain/personality.mona.yaml`
- Change avatar: Replace `mona-web/public/avatars/Mona1.vrm`
- Adjust emotions: Tweak `mona-brain/emotion.py`
- Add gestures: See `mona-web/GESTURES.md`

## Documentation

- Full setup guide: [SETUP.md](SETUP.md)
- Architecture: [README.md](README.md)
- Backend docs: [mona-brain/README.md](mona-brain/README.md)
- Frontend docs: [mona-web/README.md](mona-web/README.md)
- Gesture system: [mona-web/GESTURES.md](mona-web/GESTURES.md)
