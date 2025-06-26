# StrudelCover

AI-powered music pattern generator using Strudel.cc

## Installation

```bash
# Clone the repository
git clone git@github.com:posix4e/strudelcover.git
cd strudelcover

# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium

# Install audio analysis tools (optional but recommended)
brew install ffmpeg sox  # macOS
# OR
sudo apt-get install ffmpeg sox  # Ubuntu/Debian

# Set up Python environment for ML analysis (required)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set up API key (choose one method)
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env
# OR
export ANTHROPIC_API_KEY=your-api-key-here
```

## Quick Start

```bash
# Basic usage (audio file required, ML analysis required)
npm run cover song.mp3 "Artist" "Song Title"

# Recordings are automatically saved to ./recordings/
# Specify custom output location (also archives in ./recordings/archive/)
npm run cover song.mp3 "Artist" "Song Title" -- --record-output output.wav
```

## What it does

- Automatically runs ML analysis when available (source separation, MIDI transcription)
- Uses Claude Opus 4 AI to create complex musical arrangements
- Extracts samples from audio for authentic sounds
- Three-phase refinement: Gestalt → Kaizen → Surgery
- Plays patterns in real-time through Strudel.cc
- Shows live dashboard with pattern visualization
- Automatically records all outputs to ./recordings/

## Requirements

- Node.js 20+
- Python 3.8+ with ML dependencies (required)
- Anthropic API key from https://console.anthropic.com/
- Git for cloning the repository
- ffmpeg and sox for audio processing

## Examples

```bash
# Basic usage
npm run cover track.mp3 "Pink Floyd" "Comfortably Numb"

# With video recording
npm run cover track.mp3 "Daft Punk" "One More Time" -- --record-output video.webm
```

## Development

```bash
npm test        # Run all tests
npm run lint    # Check code style
npm run test:smoke  # Quick validation test
```

## Troubleshooting

### General Issues

- **No API key error**: Get an API key from https://console.anthropic.com/
- **Playwright issues**: Run `npx playwright install-deps` for system dependencies
- **Port 8888 in use**: The dashboard will still be accessible, check console for actual port
- **Audio file required**: An audio file path must be provided (e.g., `song.mp3`)
- **ML analysis not working**: Ensure Python dependencies are installed with `pip install -r requirements.txt`
- **No audio recording**: Install sox for audio recording support

### macOS Troubleshooting (Apple Silicon/Intel)

If you encounter compiler errors like `-fopenmp` not supported or `'is_arithmetic' cannot be specialized` when installing Python packages:

1. **Install LLVM@17 and libomp using Homebrew:**
   ```bash
   brew install llvm@17 libomp
   ```

2. **Configure environment variables for LLVM@17 and OpenMP:**
   ```bash
   export CC=$(brew --prefix llvm@17)/bin/clang
   export CXX=$(brew --prefix llvm@17)/bin/clang++
   export LDFLAGS="-L$(brew --prefix llvm@17)/lib -L$(brew --prefix libomp)/lib -Wl,-rpath,$(brew --prefix llvm@17)/lib"
   export CPPFLAGS="-I$(brew --prefix llvm@17)/include -I$(brew --prefix libomp)/include"
   ```

3. **Reinstall problematic packages (e.g., xformers):**
   ```bash
   pip install --upgrade --no-cache-dir xformers
   # Or reinstall all requirements:
   pip install -r requirements.txt --upgrade --no-cache-dir
   ```

4. **Alternative: If issues persist, comment out xformers in requirements.txt:**
   ```bash
   # Edit requirements.txt and comment out the xformers line
   # Then reinstall: pip install -r requirements.txt
   ```