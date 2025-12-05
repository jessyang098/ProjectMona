# 🚀 Deployment Guide for Project Mona

Complete guide to deploy your AI companion with anime voice to the web!

## 📋 Prerequisites

- GitHub account (you already have: jessyang098/ProjectMona)
- OpenAI API key (for GPT + Whisper)
- RunPod account with GPU pod running (you already have this set up!)

---

## 🎯 Architecture

```
User Browser → Vercel (Frontend) → Railway (Backend) → RunPod (GPU Voice)
```

- **Frontend**: Next.js on Vercel (free)
- **Backend**: FastAPI on Railway (free $5/month credit)
- **Voice**: GPT-SoVITS on RunPod GPU ($0.25/hour when running)

---

## Step 1: Deploy Backend to Railway

### A. Sign Up
1. Go to https://railway.app
2. Click "Login" → "Login with GitHub"
3. Authorize Railway to access your repos

### B. Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose **`jessyang098/ProjectMona`**
4. Railway will scan and detect the monorepo

### C. Configure Service
1. Click "Add a Service"
2. Select "Deploy from a Directory"
3. Enter: **`mona-brain`**
4. Railway auto-detects Python/FastAPI

### D. Add Environment Variables
In the Railway project settings, click "Variables" and add:

```bash
OPENAI_API_KEY=your_openai_api_key_here
PORT=8000
PYTHON_VERSION=3.11
```

### E. Get Your Backend URL
- After deployment, Railway gives you a URL like:
  ```
  https://mona-brain-production.up.railway.app
  ```
- **Save this URL** - you'll need it for the frontend

---

## Step 2: Update Backend CORS

Before deploying frontend, update backend to accept production requests.

**File**: `mona-brain/main.py` (lines 103-110)

**Change from:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**To:**
```python
import os

# CORS configuration - allows both local dev and production
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
]

# Add production frontend URL if environment variable is set
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Then in Railway, add:
```bash
FRONTEND_URL=https://your-app.vercel.app
```
(You'll update this after deploying frontend)

---

## Step 3: Deploy Frontend to Vercel

### A. Sign Up
1. Go to https://vercel.com
2. Click "Sign Up" → "Continue with GitHub"

### B. Import Project
1. Click "Add New..." → "Project"
2. Import **`jessyang098/ProjectMona`**
3. Vercel will detect it's a Next.js app

### C. Configure Build Settings

**Root Directory**: `mona-web`
**Framework Preset**: Next.js
**Build Command**: `npm run build`
**Output Directory**: `.next`
**Install Command**: `npm install`

### D. Add Environment Variable

Click "Environment Variables" and add:

```bash
NEXT_PUBLIC_BACKEND_URL=https://mona-brain-production.up.railway.app
```
(Use your actual Railway URL from Step 1E)

### E. Deploy!

Click **"Deploy"**

Vercel will:
1. Install dependencies
2. Build your Next.js app
3. Deploy to CDN
4. Give you a URL like: `https://project-mona.vercel.app`

---

## Step 4: Connect Everything

### A. Update Railway with Vercel URL

Go back to Railway → Your Project → Variables

Add or update:
```bash
FRONTEND_URL=https://project-mona.vercel.app
```
(Use your actual Vercel URL from Step 3E)

Railway will auto-redeploy with new CORS settings.

### B. Test the Connection

1. Open your Vercel URL: `https://project-mona.vercel.app`
2. You should see Mona!
3. Try sending a message
4. Check that:
   - Text appears
   - Mona responds
   - Anime voice plays
   - Mouth moves

---

## Step 5: Verify RunPod Integration

Your RunPod GPU server should already be configured to handle voice requests.

**Check Backend Logs** in Railway:
- Look for: `✓ Using GPT-SoVITS audio`
- Should see: `https://4io3lq5laazuh7-9880.proxy.runpod.net/tts`

If you need to update the RunPod URL, add to Railway variables:
```bash
SOVITS_URL=https://your-runpod-url.proxy.runpod.net/tts
```

---

## 💰 Cost Breakdown

| Service | Cost | Usage |
|---------|------|-------|
| Vercel (Frontend) | **$0/month** | Unlimited for personal |
| Railway (Backend) | **$5 free credit/month** | ~500 hours |
| RunPod (GPU Voice) | **$0.25/hour** | Only when pod is running |
| OpenAI API | **Pay-per-use** | ~$0.002 per message |

**Monthly estimate for moderate use:**
- Frontend: Free
- Backend: Free (within $5 credit)
- RunPod: $18/month (if running 24/7) or $2/month (8 hours/day)
- OpenAI: ~$5-10/month

**Pro tip:** Pause RunPod pod when not using to save money!

---

## 🔧 Troubleshooting

### Frontend can't connect to backend
- Check `NEXT_PUBLIC_BACKEND_URL` in Vercel
- Verify Railway backend is running
- Check CORS settings in backend

### No voice playback
- Check RunPod pod is running
- Verify `SOVITS_URL` in Railway
- Check Railway logs for TTS errors

### Backend errors
- Check `OPENAI_API_KEY` is set in Railway
- Check Railway logs for Python errors
- Verify all dependencies installed

---

## 🎉 Next Steps

### Custom Domain (Optional)
1. Buy a domain (e.g., from Namecheap)
2. Add to Vercel: Settings → Domains
3. Update DNS records as shown
4. Update `FRONTEND_URL` in Railway

### Continuous Deployment
- Push to GitHub → Auto-deploys to Vercel + Railway
- Edit code locally → Push → Live in 1-2 minutes

### Monitoring
- Railway: Check logs and metrics dashboard
- Vercel: View deployment logs and analytics
- RunPod: Monitor GPU usage and costs

---

## 📞 Support

If you run into issues:
1. Check Railway logs
2. Check Vercel function logs
3. Check RunPod terminal logs
4. Verify all environment variables are set

Your app is now live! 🎊

**Share your link:**
`https://project-mona.vercel.app`
