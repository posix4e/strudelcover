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

# Set up API key (choose one method)
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env
# OR
export ANTHROPIC_API_KEY=your-api-key-here
```

## Quick Start

```bash
# Create dummy audio file (required but not used)
touch song.mp3

# Generate a pattern
npm run cover song.mp3 "Artist" "Song Title"
```

## What it does

- Generates musical patterns from song descriptions using Claude AI
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