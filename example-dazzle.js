#!/usr/bin/env node

// Example of using dazzle mode with integrated Strudel player

import { StrudelCover } from './src/index.js';

// Example usage
console.log(`
=== StrudelCover Dazzle Mode Example ===

This minimal implementation includes:
- Real-time dashboard at http://localhost:8888
- Integrated Strudel.cc player in dashboard
- Pattern display and testing
- No external audio export needed

To run dazzle mode:

1. Set your API key:
   export OPENAI_API_KEY=your-key
   # or
   export ANTHROPIC_API_KEY=your-key

2. Run the command:
   npm run cover <audio-file> <artist> <song> -- --dazzle

3. Open http://localhost:8888 to watch the AI build patterns

4. Click "▶️ Play in Strudel" to test patterns in real-time

The dashboard shows:
- Song structure analysis
- Pattern preview with syntax highlighting
- LLM conversation history
- Real-time progress tracking
- Integrated Strudel player (using strudel.cc)

Patterns are saved as .strudel files in the output directory.
`);

// You can also use it programmatically:
/*
const cover = new StrudelCover({
  apiKey: process.env.OPENAI_API_KEY,
  dazzle: true
});

await cover.cover('song.mp3', 'Artist', 'Song Title');
*/