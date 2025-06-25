# StrudelCover - Development Guide

## Installation

When setting up StrudelCover in a new directory:

```bash
git clone git@github.com:posix4e/strudelcover.git
cd strudelcover
npm install
npx playwright install chromium
brew install aubio ffmpeg
echo "ANTHROPIC_API_KEY=your-key" > .env
```

## Overview

StrudelCover generates musical patterns using Claude AI and plays them through Strudel.cc. It consists of:

- `src/cli.js` - Command-line interface
- `src/index.js` - Main StrudelCover class
- `src/dazzle.js` - Dashboard server and pattern generation

## Key Concepts

### Pattern Generation
The system prompts Claude to create Strudel patterns (100-200 lines) with full song structure including intro, verse, chorus, bridge, and outro. Patterns include drums, bass, chords, melody, and effects.

### Browser Automation
Uses Playwright to:
- Launch browser with dashboard
- Auto-click play button in Strudel.cc iframe
- Optionally record video output

### WebSocket Communication
Real-time updates between server and dashboard for pattern delivery and status updates.

## Running StrudelCover

```bash
# Basic usage (requires real audio file)
npm run cover song.mp3 "Pink Floyd" "Wish You Were Here"

# Pre-analyze audio for faster runs
npm run analyze song.mp3

# With recording
npm run cover song.mp3 "Artist" "Song" -- --record-output video.webm
```

## Testing

Always run tests and lint before committing:
```bash
npm test        # Run all tests
npm run lint    # Check code style
npm run test:smoke  # Quick validation
```

## Important Notes

- Uses Claude 3 Opus by default (model: claude-3-opus-20240229)
- Dashboard runs on http://localhost:8888
- Video recording captures visuals only, not audio
- Ensure ANTHROPIC_API_KEY is set in environment
- Real audio file is REQUIRED for BPM and structure analysis
- Comprehensive audio analysis extracts:
  - BPM/tempo per section
  - Energy levels (onset density)
  - Volume dynamics
  - Song structure timing
- Pre-analyze files with `npm run analyze <file>` for faster runs

## Project Structure

```
├── src/
│   ├── cli.js              # CLI entry point
│   ├── index.js            # Main StrudelCover class
│   ├── dazzle.js           # Dashboard and pattern generation
│   └── templates/          # HTML and prompt templates
├── test/
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   ├── e2e/                # End-to-end tests
│   └── helpers/            # Test utilities
└── package.json
```