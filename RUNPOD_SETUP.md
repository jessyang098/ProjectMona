# RunPod Deployment Guide for Mona's Anime Voice

This guide will help you deploy GPT-SoVITS on RunPod for fast, GPU-accelerated anime voice generation.

## Cost Estimate
- **RTX 3060** (12GB): ~$0.20/hour = ~$144/month (24/7)
- **RTX 3070** (8GB): ~$0.30/hour = ~$216/month (24/7)
- **RTX 4060 Ti** (16GB): ~$0.40/hour = ~$288/month (24/7)

Can be paused when not in use to save costs.

## Step 1: Sign Up for RunPod

1. Go to https://www.runpod.io
2. Create an account
3. Add payment method
4. Add at least $10 credit to start

## Step 2: Prepare Your Voice Sample

Your voice sample needs to be accessible from RunPod. Options:

### Option A: Upload to GitHub (Recommended)
```bash
# Create a public repo or use existing one
cd /Users/vevocube/Desktop/ProjectMona
git add mona-brain/assets/mona_voice/main_sample.wav
git commit -m "Add voice sample"
git push
```

### Option B: Use a public URL
Upload your voice sample to:
- ImgBB, Imgur, or similar
- Your own web server
- Cloudinary

## Step 3: Deploy to RunPod

### Method 1: Use RunPod Template (Easiest)

1. Go to RunPod Dashboard
2. Click "Deploy" → "GPU Pod"
3. Select Template: **RunPod PyTorch**
4. Choose GPU: **RTX 3060** or better
5. Configure:
   - Container Disk: 20GB
   - Volume Disk: 10GB (optional, for persistence)
   - Expose HTTP Ports: `9880`
6. Click "Deploy"

### Method 2: Deploy from Docker (More Control)

1. In RunPod, go to "Templates"
2. Create New Template:
   - **Name**: GPT-SoVITS Mona
   - **Image**: `nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04`
   - **Exposed Ports**: `9880`
3. Deploy the template

## Step 4: Setup GPT-SoVITS on RunPod

Once your pod is running:

1. Click "Connect" → "Start Web Terminal"
2. In the terminal, run:

```bash
# Clone GPT-SoVITS
cd /workspace
git clone https://github.com/RVC-Boss/GPT-SoVITS.git
cd GPT-SoVITS

# Install dependencies
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install -r requirements.txt

# Download NLTK data (for English support)
python -c "import nltk; nltk.download('cmudict'); nltk.download('averaged_perceptron_tagger_eng')"

# Download pretrained models
python -c "
from transformers import AutoTokenizer, AutoModel
import os

# BERT model
os.makedirs('GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large', exist_ok=True)
tokenizer = AutoTokenizer.from_pretrained('hfl/chinese-roberta-wwm-ext-large')
model = AutoModel.from_pretrained('hfl/chinese-roberta-wwm-ext-large')
tokenizer.save_pretrained('GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large')
model.save_pretrained('GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large')
print('✓ BERT downloaded')
"

python -c "
from transformers import AutoModel, Wav2Vec2FeatureExtractor
import os

# HuBERT model
os.makedirs('GPT_SoVITS/pretrained_models/chinese-hubert-base', exist_ok=True)
model = AutoModel.from_pretrained('TencentGameMate/chinese-hubert-base')
extractor = Wav2Vec2FeatureExtractor.from_pretrained('TencentGameMate/chinese-hubert-base')
model.save_pretrained('GPT_SoVITS/pretrained_models/chinese-hubert-base')
extractor.save_pretrained('GPT_SoVITS/pretrained_models/chinese-hubert-base')
print('✓ HuBERT downloaded')
"

python -c "
from huggingface_hub import hf_hub_download
import os

# GPT-SoVITS v2 models
os.makedirs('GPT_SoVITS/pretrained_models/gsv-v2final-pretrained', exist_ok=True)
hf_hub_download(repo_id='lj1995/GPT-SoVITS', filename='gsv-v2final-pretrained/s1bert25hz-5kh-longer-epoch=12-step=369668.ckpt', local_dir='.')
hf_hub_download(repo_id='lj1995/GPT-SoVITS', filename='gsv-v2final-pretrained/s2G2333k.pth', local_dir='.')
print('✓ GPT-SoVITS v2 models downloaded')
"

# Update config to use GPU
sed -i 's/device: cpu/device: cuda/g' GPT_SoVITS/configs/tts_infer.yaml

# Download your voice sample
mkdir -p assets/mona_voice
wget https://YOUR_VOICE_SAMPLE_URL -O assets/mona_voice/main_sample.wav

# Start the TTS server
python api_v2.py -a 0.0.0.0 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml
```

## Step 5: Get Your RunPod URL

1. In RunPod dashboard, find your pod
2. Click "Connect"
3. Copy the **HTTP Service URL** for port 9880
4. It will look like: `https://YOUR_POD_ID-9880.proxy.runpod.net`

## Step 6: Update Your Mona Backend

On your local Mac, update the TTS URL:

```bash
# Edit mona-brain/.env
echo "SOVITS_URL=https://YOUR_POD_ID-9880.proxy.runpod.net/tts" >> mona-brain/.env
```

Then update `tts_sovits.py` to use environment variable:

```python
import os
sovits_url = os.getenv("SOVITS_URL", "http://127.0.0.1:9880/tts")
```

## Step 7: Test the Connection

```bash
# From your Mac
curl -X POST https://YOUR_POD_ID-9880.proxy.runpod.net/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello from RunPod!",
    "text_lang": "en",
    "ref_audio_path": "/workspace/GPT-SoVITS/assets/mona_voice/main_sample.wav",
    "prompt_text": "This is a sample voice.",
    "prompt_lang": "en",
    "speed_factor": 1.3
  }' \
  --output test_runpod.wav

# Play the audio to verify
afplay test_runpod.wav
```

## Cost Optimization Tips

1. **Pause When Not Using**
   - Stop pod when developing locally
   - Only run when testing/demoing

2. **Use Spot Instances**
   - 50-80% cheaper
   - May get interrupted (rare)

3. **Cache Audio Files**
   - Your backend already caches
   - Reduces GPU usage significantly

4. **Monitor Usage**
   - Check RunPod dashboard for costs
   - Set spending limits

## Troubleshooting

### Pod won't start
- Check if you have enough credit
- Try a different GPU type
- Check RunPod status page

### Can't connect to TTS
- Verify port 9880 is exposed
- Check pod logs for errors
- Make sure server is running

### Voice quality issues
- Verify voice sample path is correct
- Check GPU is being used: `nvidia-smi`
- Review server logs

## Next Steps

Once working:
1. Update backend .env with RunPod URL
2. Deploy main backend to Railway/Render
3. Deploy frontend to Vercel
4. Users get fast anime voice!

## Scaling

If you get many users:
- Increase to RTX 4090 for 3x faster generation
- Add load balancer with multiple pods
- Implement request queuing
