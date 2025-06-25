# StrudelCover

AI-powered music pattern generator using Strudel.cc with audio analysis

## Installation

```bash
# Clone the repository
git clone git@github.com:posix4e/strudelcover.git
cd strudelcover

# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium

# Install audio analysis tools
brew install aubio ffmpeg

# Set up API key (choose one method)
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env
# OR
export ANTHROPIC_API_KEY=your-api-key-here
```

## Quick Start

```bash
# Analyze your audio file (required)
npm run analyze song.mp3

# Generate a pattern with pre-analysis
npm run cover song.mp3 "Artist" "Song Title"

# Or do both in one step
npm run cover:analyze song.mp3 "Artist" "Song Title"
```

## What it does

- Analyzes audio files to extract BPM, structure, and musical features
- Generates musical patterns that match the original song's tempo and structure
- Plays patterns in real-time through Strudel.cc
- Shows live audio visualization
- Optionally records the visual output

## Requirements

- Node.js 20+
- Anthropic API key from https://console.anthropic.com/
- Git for cloning the repository
- `aubio` for audio analysis (install via `brew install aubio`)
- `ffmpeg` for audio processing (install via `brew install ffmpeg`)

## Examples

```bash
# Analyze audio first
npm run analyze track.mp3

# Generate pattern using analysis
npm run cover track.mp3 "Pink Floyd" "Comfortably Numb"

# With automatic pre-analysis
npm run cover:analyze track.mp3 "Daft Punk" "One More Time"

# With video recording
npm run cover track.mp3 "Artist" "Song" -- --record-output video.webm
```

## Audio Analysis

StrudelCover uses `aubio` to analyze your audio files and extract:
- **BPM/Tempo**: Accurate beat detection for tempo matching
- **Song Structure**: Detected sections (intro, verse, chorus, bridge, outro)
- **Musical Events**: Beat positions and onset times

The analysis creates a `.analysis.json` file that StrudelCover automatically uses to generate patterns that match your source audio.

For more details, see [Audio Analysis Documentation](docs/audio-analysis.md).

## Development

```bash
npm test        # Run all tests
npm run lint    # Check code style
npm run test:smoke  # Quick validation test

# Audio analysis
npm run analyze <audio-file>  # Run aubio analysis
./scripts/analyze-with-aubio.sh <audio-file>  # Direct script usage
```

## Troubleshooting

- **No API key error**: Get an API key from https://console.anthropic.com/
- **Playwright issues**: Run `npx playwright install-deps` for system dependencies
- **Port 8888 in use**: The app will still work, check output for actual port
- **Audio analysis failed**: Make sure `aubio` is installed: `brew install aubio`
- **No audio file**: A real audio file (MP3, WAV, etc.) is required for analysis