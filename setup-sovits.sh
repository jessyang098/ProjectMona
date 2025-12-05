#!/bin/bash

# GPT-SoVITS First-Time Setup Script
# Run this once to set up the voice cloning system

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOVITS_DIR="$PROJECT_ROOT/gpt-sovits"

echo "=========================================="
echo "    GPT-SoVITS Setup"
echo "=========================================="
echo ""

# Check if directory exists
if [ ! -d "$SOVITS_DIR" ]; then
    echo "✗ GPT-SoVITS directory not found at: $SOVITS_DIR"
    echo "Run: git clone https://github.com/RVC-Boss/GPT-SoVITS.git gpt-sovits"
    exit 1
fi

cd "$SOVITS_DIR"

# Create virtual environment
if [ ! -d "venv_sovits" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv_sovits
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment already exists"
fi

# Activate and install dependencies
echo ""
echo "📥 Installing dependencies..."
source venv_sovits/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "=========================================="
echo "    Installation Complete!"
echo "=========================================="
echo ""
echo "⚠ IMPORTANT: You still need to download pretrained models!"
echo ""
echo "Follow these steps:"
echo "1. Visit: https://github.com/RVC-Boss/GPT-SoVITS#pretrained-models"
echo "2. Download the GPT and SoVITS model weights"
echo "3. Place them in: $SOVITS_DIR/pretrained_models/"
echo ""
echo "Then run: ./start-mona.sh to start all services"
echo ""
