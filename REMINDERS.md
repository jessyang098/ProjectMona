# Project Mona - Reminders

## Pending Tasks

### 1. Enable Google OAuth Authentication
**Priority:** High
**Status:** Code complete, needs credentials

**Steps to complete:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "Google+ API" or "Google Identity"
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth 2.0 Client IDs**
6. Set application type: **Web application**
7. Add authorized redirect URI:
   - Local: `http://localhost:8000/auth/google/callback`
   - Production: `https://YOUR_RUNPOD_URL/auth/google/callback`
8. Copy the **Client ID** and **Client Secret**

**Add to RunPod environment variables:**
```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=https://YOUR_RUNPOD_URL/auth/google/callback
FRONTEND_URL=https://YOUR_FRONTEND_URL
JWT_SECRET_KEY=generate-a-random-32-char-string
```

**Install new dependencies on RunPod:**
```bash
pip install sqlalchemy aiosqlite python-jose[cryptography] authlib itsdangerous
```

---

### 2. Enable Discord OAuth Authentication
**Priority:** High
**Status:** Code complete, needs credentials

**Steps to complete:**
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to **OAuth2** section
4. Add redirect URI:
   - Local: `http://localhost:8000/auth/discord/callback`
   - Production: `https://YOUR_RUNPOD_URL/auth/discord/callback`
5. Copy the **Client ID** and **Client Secret**

**Add to RunPod environment variables:**
```bash
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_REDIRECT_URI=https://YOUR_RUNPOD_URL/auth/discord/callback
```

---

### 3. RunPod Server Persistence
**Priority:** High
**Status:** Pending

Use `tmux` to keep processes running when terminal disconnects:

```bash
# Start a persistent session
tmux new -s mona

# Run your server
python main.py

# Detach: Ctrl+B, then D
# Reattach later: tmux attach -t mona
```

---

### 4. Debug Gesture Animations
**Priority:** Medium
**Status:** Debug logging added, needs testing

Test commands to try:
- `test:clapping`
- `test:wave`
- `test:stand`
- `test:idle`

Check browser console for debug output to identify issues.

---

## Completed Tasks
- [x] Mobile audio playback fix
- [x] Mobile lip sync parity with desktop
- [x] FBX animation clip name fallback
- [x] Auth system implementation (code complete)
- [x] Guest message limiting (25 messages)
- [x] Chat history persistence for logged-in users
