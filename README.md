# StrudelCover

AI-powered music pattern generator using Strudel.cc

## Quick Start

```bash
npm install
npx playwright install chromium
npm run cover song.mp3 "Artist" "Song Title"
```

## What it does

- Generates musical patterns from song descriptions using Claude AI
- Plays patterns in real-time through Strudel.cc
- Shows live audio visualization
- Optionally records the visual output

## Requirements

- Node.js 20+
- Anthropic API key (set `ANTHROPIC_API_KEY` environment variable)

## Examples

```bash
# Basic usage
npm run cover track.mp3 "Pink Floyd" "Comfortably Numb"

# With video recording
npm run cover track.mp3 "Daft Punk" "One More Time" -- --record-output video.webm
```

## Development

```bash
npm test     # Run tests
npm run lint # Check code style
```