# StrudelCover - Development Guide

## Core Principles

1. **FAIL FAST** - No fallbacks, no demo modes, no mocks
2. **ML REQUIRED** - All ML dependencies must be installed
3. **NO DEGRADED MODE** - If any analysis fails, stop execution
4. **QUALITY FIRST** - Better to fail than produce subpar results

## Installation

When setting up StrudelCover in a new directory:

```bash
git clone git@github.com:posix4e/strudelcover.git
cd strudelcover
npm install
npx playwright install chromium
echo "ANTHROPIC_API_KEY=your-key" > .env

# Set up Python environment for ML analysis
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Overview

StrudelCover generates musical patterns using Claude AI and plays them through Strudel.cc. It consists of:

- `src/cli.js` - Command-line interface
- `src/index.js` - Main StrudelCover class
- `src/dazzle.js` - Dashboard server and pattern generation
- `src/audio-analyzer.js` - Audio analysis using ffmpeg
- `src/ml-analyzer.js` - ML-based audio analysis (source separation, transcription)
- `src/lyrics.js` - Song structure and lyrics analysis

## Key Concepts

### Pattern Generation
The system prompts Claude to create Strudel patterns (100-200 lines) with full song structure including intro, verse, chorus, bridge, and outro. Patterns include drums, bass, chords, melody, and effects.

### Browser Automation
Uses Playwright to:
- Launch browser with dashboard
- Auto-click play button in Strudel.cc iframe
- Handle pattern evaluation and error recovery

### WebSocket Communication
Real-time updates between server and dashboard for pattern delivery and status updates.

### Audio Analysis (Optional)
When ffmpeg is available:
- BPM detection
- Sample extraction
- Structure detection

### ML Analysis (Automatic)
When Python dependencies are installed:
- Source separation into stems
- MIDI transcription
- Advanced tempo and key detection

## Running StrudelCover

```bash
# Basic usage (audio file required)
npm run cover song.mp3 "Pink Floyd" "Wish You Were Here"


# With audio recording
npm run cover song.mp3 "Artist" "Song" -- --record-output audio.wav
```

## Testing

Always run tests and lint before committing:
```bash
npm test        # Run all tests
npm run lint    # Check code style
npm run test:smoke  # Quick validation
```

## Important Notes

- Uses Claude Opus 4 (model: claude-opus-4-20250514)
- Dashboard runs on http://localhost:8888
- Audio recording requires sox to be installed
- Ensure ANTHROPIC_API_KEY is set in environment
- Audio file parameter is required for analysis and sample extraction
- All recordings automatically saved to ./recordings/ (gitignored)
- ML dependencies are REQUIRED - no fallbacks

## Fail-Fast Requirements

When working on StrudelCover:
- NO FALLBACK VALUES - If analysis fails, the program must exit
- NO DEMO MODES - Real analysis only, no mocks
- NO DEGRADED OPERATION - Full functionality or nothing
- NO SILENT FAILURES - All errors must be surfaced
- NO RETRY LOOPS - Fail on first error
- DEPENDENCIES REQUIRED - ML packages must be installed

Examples of what NOT to do:
```javascript
// ❌ BAD - fallback value
return bpm || 120;

// ❌ BAD - continuing after error  
} catch (error) {
  console.warn('Analysis failed, continuing...');
}

// ❌ BAD - default structure
if (!structure) {
  structure = { intro: 0, verse: 15, chorus: 45 };
}
```

Examples of correct behavior:
```javascript
// ✅ GOOD - fail fast
if (!mlAnalysis) {
  throw new Error('ML analysis required');
}

// ✅ GOOD - surface all errors
} catch (error) {
  console.error(chalk.red(`Analysis failed: ${error.message}`));
  throw error;
}

// ✅ GOOD - no fallbacks
if (!bpm) {
  throw new Error('Could not detect BPM');
}
```

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

## macOS Troubleshooting

When installing Python ML dependencies on macOS (especially Apple Silicon M1/M2/M3), you may encounter compiler errors related to OpenMP or C++ template specialization. Here's how to fix them:

### Common Errors
- `clang: error: unsupported option '-fopenmp'`
- `error: explicit specialization of 'is_arithmetic' after instantiation`
- Compilation failures when installing xformers, torch, or other ML packages

### Solution

1. **Install LLVM@17 and OpenMP support:**
   ```bash
   brew install llvm@17 libomp
   ```

2. **Set up compiler environment variables:**
   ```bash
   # Add these to your shell session before installing Python packages
   export CC=$(brew --prefix llvm@17)/bin/clang
   export CXX=$(brew --prefix llvm@17)/bin/clang++
   export LDFLAGS="-L$(brew --prefix llvm@17)/lib -L$(brew --prefix libomp)/lib -Wl,-rpath,$(brew --prefix llvm@17)/lib"
   export CPPFLAGS="-I$(brew --prefix llvm@17)/include -I$(brew --prefix libomp)/include"
   ```

3. **Install/reinstall Python packages:**
   ```bash
   # Clean install of all requirements
   pip install -r requirements.txt --upgrade --no-cache-dir
   
   # Or just reinstall problematic packages
   pip install --upgrade --no-cache-dir xformers torch torchaudio
   ```

4. **Optional: Add to your shell profile for persistence:**
   ```bash
   # Add to ~/.zshrc or ~/.bash_profile
   echo 'export CC=$(brew --prefix llvm@17)/bin/clang' >> ~/.zshrc
   echo 'export CXX=$(brew --prefix llvm@17)/bin/clang++' >> ~/.zshrc
   echo 'export LDFLAGS="-L$(brew --prefix llvm@17)/lib -L$(brew --prefix libomp)/lib -Wl,-rpath,$(brew --prefix llvm@17)/lib"' >> ~/.zshrc
   echo 'export CPPFLAGS="-I$(brew --prefix llvm@17)/include -I$(brew --prefix libomp)/include"' >> ~/.zshrc
   ```

### Alternative Approach

If you continue to have issues with xformers specifically, you can comment it out in requirements.txt as it's optional for faster inference:

```bash
# Edit requirements.txt and comment out:
# xformers>=0.0.22

# Then reinstall
pip install -r requirements.txt
```

The system will work without xformers, just slightly slower for some ML operations.