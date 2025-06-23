# StrudelCover - Minimal Dazzle Mode

A minimal implementation of StrudelCover with only Dazzle mode functionality.

## What is Dazzle Mode?

Dazzle mode provides a real-time dashboard for watching AI-powered pattern generation. It builds songs progressively, layer by layer, with full visibility into the LLM conversation.

## Features

- Real-time web dashboard (http://localhost:8888)
- In-browser audio analysis with Essentia.js
- Progressive pattern building (drums → bass → melody → etc.)
- LLM conversation history
- Integrated Strudel.cc player
- Dynamic song structure determined by AI
- No server-side audio processing needed

## Installation

```bash
npm install
```

## Usage

```bash
# Basic usage
npm run cover "Artist" "Song Title" -- --dazzle

# With specific API key
npm run cover "Artist" "Song Title" -- --dazzle --api-key YOUR_API_KEY

# With different LLM provider
npm run cover "Artist" "Song Title" -- --dazzle --llm anthropic

# Then load your audio file in the dashboard at http://localhost:8888
```

## Requirements

- Node.js 18+
- FFmpeg (for audio processing)
- API key for OpenAI or Anthropic

## Environment Variables

```bash
# .env file
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

## How It Works

1. Analyzes input audio for tempo, key, and features
2. Opens dashboard at http://localhost:8888
3. Builds patterns layer by layer with LLM
4. Shows real-time progress and conversation
5. Exports final combined pattern

## Minimal Implementation

This is a stripped-down version containing only:
- Dazzle mode generator
- Dashboard server
- LLM providers (OpenAI/Anthropic)
- Audio analysis
- Pattern export

All other modes (sparkle, complex, basic) and RAG functionality have been removed.