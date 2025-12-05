#!/bin/bash

# Project Mona - Stop All Services

echo "==========================================="
echo "    Stopping Project Mona"
echo "==========================================="
echo ""

echo "🛑 Stopping all Mona processes..."

# Kill GPT-SoVITS
pkill -f "python api.py" 2>/dev/null && echo "  ✓ Stopped GPT-SoVITS" || echo "  • GPT-SoVITS not running"

# Kill Backend
pkill -f "python main.py" 2>/dev/null && echo "  ✓ Stopped Backend" || echo "  • Backend not running"

# Kill Frontend (npm, node, next)
pkill -f "npm run dev" 2>/dev/null
pkill -f "node.*next" 2>/dev/null
pkill -f "next-server" 2>/dev/null
echo "  ✓ Stopped Frontend"

sleep 1

echo ""
echo "==========================================="
echo "    All services stopped!"
echo "==========================================="
echo ""
