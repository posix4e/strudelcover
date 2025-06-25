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

# Install audio analysis tools
brew install aubio ffmpeg

# (Optional) Set up ML analysis
brew install pyenv  # If not installed
npm run setup:ml    # Sets up Python environment with ML models

# Set up API key (choose one method)
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env
# OR
export ANTHROPIC_API_KEY=your-api-key-here
```

## Quick Start

```bash
# Basic usage with aubio analysis
npm run cover song.mp3 "Artist" "Song Title"

# With ML analysis (after setup)
npm run analyze:full song.mp3
npm run cover song.mp3 "Artist" "Song Title"
```

## What it does

- Analyzes audio files using aubio and ML models
- Separates audio into stems (drums, bass, vocals, other)
- Transcribes audio to MIDI
- Extracts musical patterns and structure
- Generates Strudel patterns matching the original song
- Plays patterns in real-time through Strudel.cc
- Shows live audio visualization
- Optionally records the visual output

## Requirements

- Node.js 20+
- Anthropic API key from https://console.anthropic.com/
- Git for cloning the repository

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

- **No API key error**: Get an API key from https://console.anthropic.com/
- **Playwright issues**: Run `npx playwright install-deps` for system dependencies
- **Port 8888 in use**: The app will still work, check output for actual port
- **Audio file not found**: Just create an empty file with `touch song.mp3`