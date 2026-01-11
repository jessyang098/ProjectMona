# RunPod Setup Guide for Project Mona

Complete instructions for spinning up a new RunPod instance for the Mona backend (FastAPI + GPT-SoVITS).

## Quick Reference

| Setting | Value |
|---------|-------|
| **GPU** | RTX A4500 (20GB VRAM, ~$0.19/hr) |
| **Backend Port** | 8888 |
| **Voice Port** | 9880 (GPT-SoVITS) |
| **Frontend** | Deployed on Vercel |
| **Repo** | https://github.com/jessyang098/ProjectMona |

---

## Step 1: Create New Pod

### Pod Configuration
1. Go to [RunPod Pods](https://www.runpod.io/console/pods)
2. Click **+ Deploy**
3. Select GPU: **RTX A4500** (20GB VRAM, ~$0.19/hr)
   - Alternative: RTX 4090 (24GB VRAM) if A4500 unavailable
4. Select template: **RunPod Pytorch 2.1** (or similar CUDA-enabled template)

### Pod Settings
| Option | Value |
|--------|-------|
| GPU Count | 1 |
| Volume | 50GB+ recommended |
| Encrypt Volume | No |
| SSH Terminal Access | Yes |
| Start Jupyter Notebook | No |

### Expose Ports
Add HTTP ports:
- **8888** - FastAPI backend (chat, auth, API)
- **9880** - GPT-SoVITS voice server (TTS)

Click **Deploy** and wait for pod to initialize.

---

## Step 2: Connect to Pod

1. Click **Connect** on your pod
2. Choose **SSH Terminal** or web terminal
3. You should be in `/workspace` directory

---

## Step 3: Clone Repository

```bash
cd /workspace
git clone https://github.com/jessyang098/ProjectMona.git
cd ProjectMona/mona-brain
```

---

## Step 4: Install Dependencies

```bash
# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

This installs:
- FastAPI + Uvicorn
- PyTorch with CUDA 12.4
- GPT-SoVITS dependencies (transformers, peft, etc.)
- SQLAlchemy + aiosqlite for database
- OAuth libraries (authlib, python-jose)

---

## Step 5: Set Up Environment Variables

### Option A: Create .env file

```bash
cd /workspace/ProjectMona/mona-brain
cat > .env << 'EOF'
# OpenAI
OPENAI_API_KEY=sk-your-openai-key-here

# JWT Secret (generate a random string)
JWT_SECRET=your-random-secret-key-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Discord OAuth
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret

# Frontend URL (your Vercel deployment)
FRONTEND_URL=https://your-app.vercel.app

# Server config
HOST=0.0.0.0
PORT=8888
EOF
```

### Option B: Use RunPod Environment Variables
1. Go to pod settings in RunPod dashboard
2. Add environment variables directly (they persist across restarts)

---

## Step 6: Update OAuth Redirect URIs

When you create a new pod, the URL changes. Update these:

### Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Edit your OAuth 2.0 Client ID
3. Add to **Authorized redirect URIs**:
   ```
   https://YOUR-POD-ID-8888.proxy.runpod.net/auth/google/callback
   ```

### Discord Developer Portal
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application > OAuth2
3. Add to **Redirects**:
   ```
   https://YOUR-POD-ID-8888.proxy.runpod.net/auth/discord/callback
   ```

**Find your pod URL**: Click "Connect" > "HTTP Service [Port 8888]" to see the full URL.

---

## Step 7: Start the Server

```bash
cd /workspace/ProjectMona/mona-brain
source venv/bin/activate  # if using venv

# Start FastAPI server
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --host 0.0.0.0 --port 8888 --reload
```

Server should show:
```
INFO:     Uvicorn running on http://0.0.0.0:8888
```

---

## Step 8: Update Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project > Settings > Environment Variables
3. Update these variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-POD-ID-8888.proxy.runpod.net` |
| `NEXT_PUBLIC_WEBSOCKET_URL` | `wss://YOUR-POD-ID-8888.proxy.runpod.net/ws` |
| `NEXT_PUBLIC_BACKEND_URL` | `https://YOUR-POD-ID-8888.proxy.runpod.net` |

**Important**:
- API/Backend use `https://`
- WebSocket uses `wss://` (secure websocket) and ends with `/ws`

4. **Redeploy** the frontend for changes to take effect

---

## Step 9: Test Connection

```bash
# Check backend health
curl https://YOUR-POD-ID-8888.proxy.runpod.net/health

# Visit your Vercel frontend and test:
# - Chat functionality
# - Google/Discord sign-in
# - Profile updates
```

---

## Quick Start Checklist

- [ ] Create pod with RTX A4500, ports **8888** and **9880** exposed
- [ ] Clone repo: `git clone https://github.com/jessyang098/ProjectMona.git`
- [ ] Install deps: `cd mona-brain && pip install -r requirements.txt`
- [ ] Create `.env` with API keys
- [ ] Update Google OAuth redirect URI
- [ ] Update Discord OAuth redirect URI
- [ ] Start backend server: `python main.py`
- [ ] Start voice server (if using TTS): see GPT-SoVITS section below
- [ ] Update Vercel environment variables:
  - `NEXT_PUBLIC_API_URL` = `https://YOUR-POD-ID-8888.proxy.runpod.net`
  - `NEXT_PUBLIC_WEBSOCKET_URL` = `wss://YOUR-POD-ID-8888.proxy.runpod.net/ws`
  - `NEXT_PUBLIC_BACKEND_URL` = `https://YOUR-POD-ID-8888.proxy.runpod.net`
- [ ] Redeploy Vercel frontend
- [ ] Test sign-in and chat

---

## Keeping Your Data Safe

**Why pods lose data**: When you stop a pod, its GPU may be allocated to another user. The volume data can be lost.

### Solutions

1. **Network Volumes** (Recommended)
   - Create a Network Volume in RunPod
   - Mount it to `/workspace`
   - Data persists even when pod is terminated

2. **Keep Pod Running**
   - More expensive but data is safe
   - Consider using spot instances for lower cost

3. **External Database** (for production)
   - Use Supabase, PlanetScale, or similar
   - Database survives pod termination

4. **Git Push Regularly**
   - Push code changes to GitHub
   - At least you won't lose code

---

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for GPT | `sk-...` |
| `JWT_SECRET` | Secret for JWT tokens | Random 32+ char string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | From Google Cloud |
| `DISCORD_CLIENT_ID` | Discord OAuth client ID | From Discord Dev Portal |
| `DISCORD_CLIENT_SECRET` | Discord OAuth secret | From Discord Dev Portal |
| `FRONTEND_URL` | Your Vercel frontend URL | `https://app.vercel.app` |
| `HOST` | Server bind address | `0.0.0.0` |
| `PORT` | Server port | `8888` |

---

## Common Issues

### Port not accessible
- Make sure port 8888 is exposed in pod settings
- Check that server is running with `--host 0.0.0.0`

### OAuth redirect fails
- Double-check redirect URIs match exactly (including https)
- Make sure FRONTEND_URL in .env matches your Vercel URL

### CORS errors
- Backend should have CORS configured for your Vercel domain
- Check `main.py` for CORS middleware configuration

### Out of GPU memory
- GPT-SoVITS needs ~10-15GB VRAM
- Make sure you're using A4500 (20GB) or similar

---

## Files to Back Up

Before terminating pod:

```bash
# Back up database
cp /workspace/ProjectMona/mona-brain/mona.db ~/mona_backup.db

# Back up any custom model files
tar -czvf models_backup.tar.gz /workspace/ProjectMona/mona-brain/models/
```

---

## GPT-SoVITS Voice Server Setup (Port 9880)

If you need GPT-SoVITS for voice generation:

### 1. Clone GPT-SoVITS

```bash
cd /workspace
git clone https://github.com/RVC-Boss/GPT-SoVITS.git
cd GPT-SoVITS
pip install -r requirements.txt
```

### 2. Download NLTK Data

```bash
python -c "import nltk; nltk.download('cmudict'); nltk.download('averaged_perceptron_tagger_eng')"
```

### 3. Download Pretrained Models

```bash
pip install huggingface_hub

# Download GPT-SoVITS core model weights (REQUIRED)
python -c "
from huggingface_hub import hf_hub_download

# GPT (s1) model
hf_hub_download(
    repo_id='lj1995/GPT-SoVITS',
    filename='gsv-v2final-pretrained/s1bert25hz-5kh-longer-epoch=12-step=369668.ckpt',
    local_dir='GPT_SoVITS/pretrained_models',
    local_dir_use_symlinks=False
)

# SoVITS (s2) model
hf_hub_download(
    repo_id='lj1995/GPT-SoVITS',
    filename='gsv-v2final-pretrained/s2G2333k.pth',
    local_dir='GPT_SoVITS/pretrained_models',
    local_dir_use_symlinks=False
)
print('GPT-SoVITS models downloaded!')
"

# Download BERT model
python -c "
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id='hfl/chinese-roberta-wwm-ext-large',
    local_dir='GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large',
    local_dir_use_symlinks=False
)
print('BERT downloaded!')
"

# Download HuBERT model
python -c "
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id='TencentGameMate/chinese-hubert-base',
    local_dir='GPT_SoVITS/pretrained_models/chinese-hubert-base',
    local_dir_use_symlinks=False
)
print('HuBERT downloaded!')
"
```

### 4. Add Your Voice Sample

```bash
mkdir -p /workspace/GPT-SoVITS/assets/mona_voice
# Copy your voice sample here as main_sample.wav
```

### 5. Start the Voice Server

```bash
cd /workspace/GPT-SoVITS
python api_v2.py -a 0.0.0.0 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml
```

The voice server will be available at:
```
https://YOUR-POD-ID-9880.proxy.runpod.net
```

### 6. Update Backend .env

Add the voice server URL to your mona-brain `.env`:

```bash
SOVITS_URL=https://YOUR-POD-ID-9880.proxy.runpod.net/tts
```

### 7. Test Voice Generation

```bash
curl -X POST https://YOUR-POD-ID-9880.proxy.runpod.net/tts \
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
```

### Running Both Servers

You can run both servers in the same terminal using background processes:

```bash
# Terminal 1: Start backend
cd /workspace/ProjectMona/mona-brain
python main.py &

# Terminal 2: Start voice server
cd /workspace/GPT-SoVITS
python api_v2.py -a 0.0.0.0 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml &

# View logs
jobs  # See running background jobs
fg %1 # Bring job 1 to foreground
```

Or use `screen` or `tmux` for persistent sessions.

---

## Cost Optimization

1. **Pause When Not Using** - Stop pod during development
2. **Use Spot Instances** - 50-80% cheaper (may get interrupted)
3. **Monitor Usage** - Check RunPod dashboard for costs
4. **Set Spending Limits** - Prevent unexpected charges
