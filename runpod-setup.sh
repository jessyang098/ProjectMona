#!/bin/bash
# RunPod GPT-SoVITS Complete Setup Script
# Run this after starting/restarting your RunPod instance

set -e  # Exit on error

echo "🚀 Starting RunPod GPT-SoVITS setup..."

# 1. Install system dependencies
echo "📦 Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq ffmpeg git wget curl pkg-config libssl-dev build-essential

# 2. Ensure Rust is available (RunPod usually has it, but check anyway)
if ! command -v rustc &> /dev/null; then
    echo "🦀 Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    export PATH="$HOME/.cargo/bin:$PATH"
else
    echo "✓ Rust already installed"
fi

# 3. Install Python dependencies
echo "🐍 Installing Python packages..."
pip install -q --upgrade pip
pip install -q fastapi uvicorn nltk requests pydantic python-multipart

# 3. Download NLTK data (critical for English TTS)
echo "📚 Downloading NLTK data..."
python3 -c "
import nltk
import ssl
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

nltk.download('averaged_perceptron_tagger_eng', quiet=True)
nltk.download('cmudict', quiet=True)
print('✓ NLTK data downloaded')
"

# 4. Clone GPT-SoVITS if not already present
if [ ! -d "GPT-SoVITS" ]; then
    echo "📥 Cloning GPT-SoVITS repository..."
    git clone https://github.com/RVC-Boss/GPT-SoVITS.git
    cd GPT-SoVITS
else
    echo "✓ GPT-SoVITS directory already exists"
    cd GPT-SoVITS
fi

# 5. Fix transformers and tokenizers version compatibility (avoids Rust requirement!)
echo "🔧 Installing compatible transformers & tokenizers versions..."
pip install -q "transformers==4.30.0" "tokenizers==0.13.2"

# 5b. Install GPT-SoVITS requirements
echo "📦 Installing GPT-SoVITS requirements..."
pip install -q -r requirements.txt

# 6. Download pretrained models
echo "🤖 Downloading pretrained models..."
mkdir -p GPT_SoVITS/pretrained_models

# Note: Pretrained models will be downloaded by GPT-SoVITS on first run
# if they're needed. The repo structure has changed.
echo "✓ Model directory created (models download on first API call)"

# 7. Verify voice sample exists
echo "🔍 Checking for Mona voice sample..."
if [ -f "/workspace/GPT-SoVITS/assets/mona_voice/main_sample.wav" ]; then
    echo "✓ Voice sample found: $(ls -lh /workspace/GPT-SoVITS/assets/mona_voice/main_sample.wav)"
else
    echo "⚠️  WARNING: Voice sample not found at /workspace/GPT-SoVITS/assets/mona_voice/main_sample.wav"
    echo "   Please upload your voice sample to this location"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎤 To start the GPT-SoVITS API server, run:"
echo "   cd /workspace/GPT-SoVITS"
echo "   python api_v2.py -a 0.0.0.0 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml"
echo ""
echo "🌐 Your API will be available at:"
echo "   https://YOUR-POD-ID.proxy.runpod.net/tts"
echo ""
