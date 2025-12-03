# Project Mona - Quick Setup Guide

## Prerequisites

- **Python 3.9+** - [Download Python](https://www.python.org/downloads/)
- **Node.js 18+** - [Download Node.js](https://nodejs.org/)
- **OpenAI API Key** - [Get API Key](https://platform.openai.com/api-keys) (optional, but recommended)

## Step-by-Step Setup

### 1. Clone/Download the Project

You should already have the project. Navigate to the project directory:

```bash
cd ProjectMona
```

### 2. Backend Setup (mona-brain)

Open a terminal and run:

```bash
# Navigate to backend
cd mona-brain

# Create Python virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
```

Now edit the `.env` file and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Frontend Setup (mona-web)

Open a **new terminal** (keep the backend terminal open) and run:

```bash
# Navigate to frontend (from ProjectMona root)
cd mona-web

# Install dependencies
npm install
```

### 4. Run the Application

**Terminal 1 (Backend):**
```bash
cd mona-brain
source venv/bin/activate  # Or venv\Scripts\activate on Windows
python main.py
```

You should see:
```
✓ Mona LLM initialized with GPT
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Terminal 2 (Frontend):**
```bash
cd mona-web
npm run dev
```

You should see:
```
▲ Next.js 15.x.x
- Local:        http://localhost:3000
```

### 5. Open the App

Open your browser and go to: **[http://localhost:3000](http://localhost:3000)**

You should see Mona's chat interface!

## Troubleshooting

### "Could not initialize LLM" Error

If you see this warning:
```
⚠ Warning: Could not initialize LLM
⚠ Running in DUMMY mode
```

**Solution:**
- Check that you've set `OPENAI_API_KEY` in your `.env` file
- Make sure the API key is valid
- Restart the backend server

### Frontend Can't Connect to Backend

**Check:**
1. Backend is running on port 8000
2. No firewall blocking localhost connections
3. Check browser console for WebSocket errors

### Import Errors in Python

**Solution:**
```bash
# Make sure you activated the virtual environment
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

### npm install Errors

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Testing Without OpenAI API Key

You can test the app without an API key in "dummy mode":

1. Don't set `OPENAI_API_KEY` in `.env` (or leave it as the example)
2. Start the backend - it will show "Running in DUMMY mode"
3. Mona will respond with simple keyword-based responses instead of GPT

This is useful for:
- Testing the UI/UX
- Development without API costs
- Checking WebSocket connectivity

## Current Features (Week 4 Complete)

✅ **Working Now:**
- Real-time chat with GPT-4 powered responses
- Personality system with customizable traits
- Emotion engine that reacts to conversation
- 3D VRM avatar with facial expressions
- Procedural idle animations (blinking, head movement, breathing)
- Memory and affection systems
- Streaming message responses

## Week 5 Progress (In Progress)

🚧 **Animation Utilities Added:**
- `lib/animation/mixamoLoader.ts` - Load Mixamo FBX gesture animations
- `lib/animation/lipSyncManager.ts` - Real-time lip sync with audio analysis
- `lib/animation/mixamoRigMap.ts` - Bone mapping for animation retargeting

📝 **Coming Next:**
- Voice input (ASR - Automatic Speech Recognition)
- Voice output (TTS - Text-to-Speech)
- Gesture animations triggered by emotions
- Lip sync during voice playback

## Next Steps

Once everything is working:

1. **Chat with Mona** - Try different messages and see her personality!
2. **Watch Her Avatar** - Notice the idle animations and emotion expressions
3. **Check Emotions** - See how she responds differently based on context
4. **Explore the Code** - Look at `personality.mona.yaml` to customize traits
5. **Experiment** - Try changing animation parameters in `VRMAvatar.tsx`

## Need Help?

- Check the main [README.md](README.md) for architecture details
- Read [mona-brain/README.md](mona-brain/README.md) for backend documentation
- Read [mona-web/README.md](mona-web/README.md) for frontend documentation

---

# GPT-SoVITS Setup for High-Quality Anime Voice

This section covers setting up GPT-SoVITS for voice cloning with Riko's anime voice sample.

## What is GPT-SoVITS?

GPT-SoVITS is a voice cloning system that replicates any voice from a short audio sample. We use it to give Mona a natural anime-style voice based on Riko's voice.

## Why GPT-SoVITS?

- **Better Quality**: More natural-sounding than standard TTS
- **Voice Cloning**: Uses Riko's actual anime voice sample
- **Expressiveness**: Better emotional range and intonation
- **Local Control**: Runs on your machine, no cloud API costs

## Prerequisites

- Python 3.9 or higher
- At least 4GB RAM
- GPU recommended but not required (CPU works but slower)
- ~2GB disk space for models

## Installation Steps

### 1. Clone GPT-SoVITS Repository

Open a new terminal:

```bash
cd ~/Desktop
git clone https://github.com/RVC-Boss/GPT-SoVITS.git
cd GPT-SoVITS
```

### 2. Install Dependencies

```bash
# Create a separate virtual environment for SoVITS
python -m venv venv_sovits
source venv_sovits/bin/activate  # On Windows: venv_sovits\Scripts\activate

# Install requirements
pip install -r requirements.txt
```

### 3. Download Pre-trained Models

GPT-SoVITS requires pre-trained models. Follow the instructions in the [official repository](https://github.com/RVC-Boss/GPT-SoVITS#pretrained-models) to download:

1. GPT weights
2. SoVITS weights

Place them in `GPT-SoVITS/pretrained_models/`

### 4. Start the GPT-SoVITS API Server

```bash
# Make sure you're in the GPT-SoVITS directory
cd ~/Desktop/GPT-SoVITS
source venv_sovits/bin/activate

# Start the API server
python api.py
```

The server will start on `http://127.0.0.1:9880`

**Keep this terminal running!** You'll need three terminals total:
1. GPT-SoVITS server (this one)
2. Mona backend (mona-brain)
3. Mona frontend (mona-web)

### 5. Verify Server is Running

Open a new terminal and test:

```bash
curl -I http://127.0.0.1:9880/tts
```

You should see HTTP 200 or 405 (means server is responding).

## Configuration for Project Mona

The integration is already set up! The code automatically:

1. **Checks for SoVITS**: On startup, checks if GPT-SoVITS server is available
2. **Uses Riko's Voice**: Loads the voice sample from `mona-brain/assets/mona_voice/main_sample.wav`
3. **Falls Back Gracefully**: If SoVITS is unavailable, uses OpenAI TTS

### Starting Mona with Voice

With GPT-SoVITS server running, start Mona:

```bash
cd mona-brain
source venv/bin/activate
python main.py
```

Look for these messages:
```
✓ Mona GPT-SoVITS initialized with Riko voice sample
✓ Mona TTS initialized with OpenAI (fallback)
```

### Testing the Voice

1. Start all three services:
   - GPT-SoVITS server on port 9880
   - Mona backend on port 8000
   - Mona frontend on port 3000

2. Open [http://localhost:3000](http://localhost:3000)

3. Send Mona a message

4. You should hear Riko's anime voice! The console will show:
   ```
   ⚡ Generating SoVITS speech for: [your message]
   ✓ SoVITS audio saved: [hash].wav
   ✓ Using GPT-SoVITS audio
   ```

## Troubleshooting

### "SoVITS server not running"

**Symptoms**: Backend shows warning, falls back to OpenAI TTS

**Solutions**:
- Verify GPT-SoVITS server is running: `curl http://127.0.0.1:9880/tts`
- Check the GPT-SoVITS terminal for errors
- Restart the GPT-SoVITS server: `python api.py`
- Check port 9880 isn't blocked

### "Voice sample not found"

**Symptoms**: Backend warning about missing voice file

**Solutions**:
- Verify file exists: `ls mona-brain/assets/mona_voice/main_sample.wav`
- Check file permissions
- Make sure you're running from the correct directory

### Slow Voice Generation

**Symptoms**: Takes 5-10+ seconds to generate speech

**Solutions**:
- **Use GPU**: Install CUDA-enabled PyTorch for 10x speedup
- **First run is slow**: Models need to load, subsequent generations are faster
- **Enable caching**: Audio is cached automatically, repeated phrases are instant
- **Use shorter messages**: Break long responses into smaller chunks

### Poor Voice Quality

**Issues**: Voice doesn't sound like Riko, has artifacts, or sounds robotic

**Solutions**:
- Ensure reference audio is high quality (current sample is good)
- Adjust `speed_factor` in [main.py:55](mona-brain/main.py#L55) (try values between 1.0-1.5)
- Check prompt text matches the audio transcription
- Try generating the same text multiple times (results can vary)

### GPU Setup (Optional but Recommended)

For 10x faster generation:

```bash
# Check if you have NVIDIA GPU
nvidia-smi

# Install CUDA-enabled PyTorch (in GPT-SoVITS venv)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

## Advanced Configuration

### Customize Voice Settings

Edit [mona-brain/main.py](mona-brain/main.py) around line 52:

```python
mona_tts_sovits = MonaTTSSoVITS(
    ref_audio_path=str(riko_sample),
    prompt_text="Your custom transcription",  # Must match audio
    speed_factor=1.3,  # 1.0 = normal, 1.5 = faster
    text_lang="en",     # Input language
    prompt_lang="en",   # Reference audio language
)
```

### Use a Different Voice Sample

To use your own anime voice:

1. Get a clean 5-10 second audio clip (WAV format, 22050Hz recommended)
2. Transcribe it **exactly** (every word, pause, breath)
3. Place it in `mona-brain/assets/mona_voice/custom_voice.wav`
4. Update [main.py:52-54](mona-brain/main.py#L52-L54):
   ```python
   riko_sample = Path("assets/mona_voice/custom_voice.wav")
   prompt_text="Your exact transcription here"
   ```

### Clear Audio Cache

Audio is cached to avoid regenerating the same speech:

```bash
# Clear all cached audio
rm mona-brain/assets/audio_cache/*.wav
```

Cache files are named by hash of (text + voice sample + speed factor).

## Performance Benchmarks

**Without GPU (CPU only)**:
- First generation: ~8-15 seconds
- Subsequent: ~5-10 seconds
- Cached: Instant

**With GPU (NVIDIA)**:
- First generation: ~2-4 seconds
- Subsequent: ~1-2 seconds
- Cached: Instant

## Resources

- [GPT-SoVITS GitHub](https://github.com/RVC-Boss/GPT-SoVITS)
- [GPT-SoVITS Documentation](https://github.com/RVC-Boss/GPT-SoVITS/wiki)
- [CUDA Installation Guide](https://docs.nvidia.com/cuda/cuda-installation-guide-linux/)
- [PyTorch CUDA Setup](https://pytorch.org/get-started/locally/)
