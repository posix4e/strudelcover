# StrudelCover - Development Guide

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

## Testing

Always run tests and lint before committing:
```bash
npm test
npm run lint
```

## Important Notes

- Uses Claude 3 Opus by default (model: claude-3-opus-20240229)
- Dashboard runs on http://localhost:8888
- Video recording captures visuals only, not audio
- Ensure ANTHROPIC_API_KEY is set in environment