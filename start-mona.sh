#!/bin/bash

# Project Mona - Unified Startup Script
# Starts all required services: GPT-SoVITS, Backend, and Frontend

set -e  # Exit on error

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOVITS_DIR="$PROJECT_ROOT/gpt-sovits"
BACKEND_DIR="$PROJECT_ROOT/mona-brain"
FRONTEND_DIR="$PROJECT_ROOT/mona-web"

echo "=========================================="
echo "    Starting Project Mona"
echo "=========================================="
echo ""

# Check if GPT-SoVITS exists
if [ ! -d "$SOVITS_DIR" ]; then
    echo "⚠ GPT-SoVITS not found at: $SOVITS_DIR"
    echo ""
    echo "First time setup required:"
    echo "1. Install dependencies: cd gpt-sovits && python -m venv venv_sovits && source venv_sovits/bin/activate && pip install -r requirements.txt"
    echo "2. Download pretrained models (see SETUP.md for instructions)"
    echo ""
    read -p "Do you want to skip GPT-SoVITS and use OpenAI TTS fallback? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    SKIP_SOVITS=true
else
    SKIP_SOVITS=false
fi

# Check if backend exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo "✗ Backend not found at: $BACKEND_DIR"
    exit 1
fi

# Check if frontend exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "✗ Frontend not found at: $FRONTEND_DIR"
    exit 1
fi

# Start GPT-SoVITS server (if available)
if [ "$SKIP_SOVITS" = false ]; then
    echo "🎤 Starting GPT-SoVITS server..."
    osascript -e "tell application \"Terminal\" to do script \"cd '$SOVITS_DIR' && source venv_sovits/bin/activate && python api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml\""
    echo "   → Terminal opened for GPT-SoVITS (port 9880)"
    echo "   → Waiting 8 seconds for server to initialize..."
    sleep 8
else
    echo "⊘ Skipping GPT-SoVITS (will use OpenAI TTS fallback)"
fi

# Start Mona backend
echo "🧠 Starting Mona backend..."
osascript -e "tell application \"Terminal\" to do script \"cd '$BACKEND_DIR' && source venv/bin/activate && python main.py\""
echo "   → Terminal opened for backend (port 8000)"
echo "   → Waiting 5 seconds for backend to initialize..."
sleep 5

# Start Mona frontend
echo "🌐 Starting Mona frontend..."
osascript -e "tell application \"Terminal\" to do script \"cd '$FRONTEND_DIR' && npm run dev\""
echo "   → Terminal opened for frontend (port 3000)"

echo ""
echo "=========================================="
echo "    All services started!"
echo "=========================================="
echo ""
echo "Services running:"
if [ "$SKIP_SOVITS" = false ]; then
    echo "  🎤 GPT-SoVITS:  http://127.0.0.1:9880"
fi
echo "  🧠 Backend:     http://localhost:8000"
echo "  🌐 Frontend:    http://localhost:3000"
echo ""
echo "Open your browser to: http://localhost:3000"
echo ""
echo "To stop all services: Close the Terminal windows or press Ctrl+C in each"
echo ""
