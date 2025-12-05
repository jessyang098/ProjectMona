# Fix RunPod GPU Voice Generation

## The Problem
Your RunPod server is missing NLTK data, causing voice generation to fail with errors.

## The Fix

### Step 1: Download Missing NLTK Data

In your **RunPod Web Terminal**, run this command:

```bash
python -c "import nltk; nltk.download('averaged_perceptron_tagger_eng')"
```

You should see output like:
```
[nltk_data] Downloading package averaged_perceptron_tagger_eng to...
[nltk_data] Unzipping taggers/averaged_perceptron_tagger_eng.zip.
```

### Step 2: Restart the GPT-SoVITS Server

1. If the server is still running, press `Ctrl+C` to stop it
2. Start it again with:

```bash
export HF_HUB_ENABLE_HF_TRANSFER=0 && python api_v2.py -a 0.0.0.0 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml
```

### Step 3: Test GPU Voice Generation

On your **local Mac**, run this test:

```bash
curl -X POST https://4io3lq5laazuh7-9880.proxy.runpod.net/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello! This is Mona speaking from the RunPod GPU server!",
    "text_lang": "en",
    "ref_audio_path": "/workspace/GPT-SoVITS/assets/mona_voice/main_sample.wav",
    "prompt_text": "This is a sample voice for you to get started with.",
    "prompt_lang": "en",
    "speed_factor": 1.3
  }' \
  --output /tmp/runpod_gpu_test.wav
```

Then play it:
```bash
afplay /tmp/runpod_gpu_test.wav
```

**What you should hear:** Mona's anime voice saying the test message

**What you should NOT hear:** Error or silence

### Step 4: Test Your Mona App

Once the test above works:

1. Make sure your Mona app is running (or run `./start-mona.sh`)
2. Open http://localhost:3000 in your browser
3. Send a message to Mona
4. You should hear her anime voice respond (generated in 1-2 seconds instead of 5-10!)

## How to Verify It's Using GPU

In the RunPod terminal where the server is running, you should see:

```
✓ Speech generated successfully (GPU accelerated)
Device: cuda
is_half: True
```

The RunPod terminal will show logs every time a voice is generated.

## Current Status

✅ Your local backend is configured to use RunPod: `https://4io3lq5laazuh7-9880.proxy.runpod.net/tts`
✅ RunPod server is running and accessible
✅ GPU is enabled (RTX A4000)
❌ NLTK data missing - preventing voice generation

Once you complete Step 1 and 2 above, everything will work!

## Cost Reminder

- RunPod charges **$0.25/hour** while your pod is running
- Stop the pod when not testing to save money
- Resume it anytime you need GPU-accelerated voice
