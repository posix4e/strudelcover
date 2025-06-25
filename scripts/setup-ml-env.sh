#!/bin/bash

# Setup ML environment for StrudelCover
# Requires pyenv to be installed

set -e

echo "🐍 Setting up Python ML environment for StrudelCover"
echo "=================================================="

# Check if pyenv is installed
if ! command -v pyenv &> /dev/null; then
    echo "❌ Error: pyenv is not installed"
    echo "Please install pyenv first:"
    echo "  brew install pyenv"
    echo "  echo 'eval \"\$(pyenv init -)\"' >> ~/.zshrc"
    exit 1
fi

# Get the required Python version
PYTHON_VERSION=$(cat .python-version)
echo "📦 Required Python version: $PYTHON_VERSION"

# Install Python version if not available
if ! pyenv versions | grep -q "$PYTHON_VERSION"; then
    echo "📥 Installing Python $PYTHON_VERSION..."
    pyenv install "$PYTHON_VERSION"
else
    echo "✅ Python $PYTHON_VERSION already installed"
fi

# Set local Python version
pyenv local "$PYTHON_VERSION"

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "🔧 Creating virtual environment..."
    python -m venv venv
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip setuptools wheel

# Install requirements
echo "📦 Installing ML packages..."
echo "This may take a while, especially for PyTorch..."

# Install PyTorch first (CPU version by default)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - check for Apple Silicon
    if [[ $(uname -m) == 'arm64' ]]; then
        echo "🍎 Detected Apple Silicon - installing PyTorch with MPS support"
        pip install torch torchvision torchaudio
    else
        echo "💻 Detected Intel Mac - installing PyTorch CPU version"
        pip install torch torchvision torchaudio
    fi
else
    echo "🐧 Installing PyTorch for Linux/other"
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
fi

# Install other requirements
pip install -r requirements.txt

# Optional: Install Essentia (may require additional system dependencies)
echo ""
echo "📦 Attempting to install Essentia (optional)..."
if pip install essentia; then
    echo "✅ Essentia installed successfully"
else
    echo "⚠️  Essentia installation failed (optional, continuing...)"
fi

# Create activation script
cat > activate-ml.sh << 'EOF'
#!/bin/bash
# Activate ML environment for StrudelCover
source venv/bin/activate
echo "🎵 ML environment activated!"
echo "Run: python scripts/analyze-with-ml.py <audio-file>"
EOF
chmod +x activate-ml.sh

echo ""
echo "✅ ML environment setup complete!"
echo ""
echo "To use the ML analysis:"
echo "  1. Activate environment: source activate-ml.sh"
echo "  2. Run analysis: python scripts/analyze-with-ml.py song.mp3"
echo ""
echo "Or use the npm script (once added):"
echo "  npm run analyze:ml song.mp3"