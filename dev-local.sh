#!/bin/bash
# Local Development Script for Mona
# Runs both backend and frontend for local testing

echo "=========================================="
echo "  Mona Local Development Environment"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env files exist
if [ ! -f "mona-brain/.env" ]; then
    echo -e "${YELLOW}Warning: mona-brain/.env not found${NC}"
    echo "Copy mona-brain/.env.example to mona-brain/.env and configure it"
    echo ""
fi

if [ ! -f "mona-web/.env.local" ]; then
    echo -e "${YELLOW}Warning: mona-web/.env.local not found${NC}"
    echo "Copy mona-web/.env.example to mona-web/.env.local"
    echo ""
fi

# Parse arguments
MOCK_TTS=false
for arg in "$@"; do
    case $arg in
        --mock-tts)
            MOCK_TTS=true
            shift
            ;;
    esac
done

echo "Starting services..."
echo ""

# Start backend
echo -e "${GREEN}[1/2] Starting Backend (mona-brain)${NC}"
if [ "$MOCK_TTS" = true ]; then
    echo "       Mode: MOCK TTS (no audio generation)"
    (cd mona-brain && SOVITS_URL=mock python -m uvicorn main:app --reload --port 8000) &
else
    echo "       Mode: Normal (uses configured SOVITS_URL)"
    (cd mona-brain && python -m uvicorn main:app --reload --port 8000) &
fi
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
echo -e "${GREEN}[2/2] Starting Frontend (mona-web)${NC}"
(cd mona-web && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "=========================================="
echo -e "${GREEN}Services Running:${NC}"
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo "=========================================="

# Cleanup on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup INT TERM

# Wait for processes
wait
