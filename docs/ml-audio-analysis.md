# ML-Powered Audio Analysis for StrudelCover

This document describes the advanced ML-based audio analysis capabilities that complement the aubio analysis.

## Overview

The ML analysis pipeline uses state-of-the-art models to extract:
- **Source Separation**: Isolate drums, bass, vocals, and other stems
- **Polyphonic Transcription**: Convert audio to MIDI with multiple instruments
- **Audio Embeddings**: Deep learning features for similarity and understanding
- **Advanced Pattern Extraction**: Melodic, rhythmic, and harmonic patterns

## Installation

### 1. Install pyenv (if not already installed)
```bash
brew install pyenv
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
source ~/.zshrc
```

### 2. Set up ML environment
```bash
npm run setup:ml
```

This will:
- Install Python 3.11.7
- Create a virtual environment
- Install ML packages (PyTorch, Transformers, Demucs, etc.)

## Usage

### Basic ML Analysis
```bash
# Activate environment and run analysis
source activate-ml.sh
python scripts/analyze-with-ml.py song.mp3
```

### Using npm scripts
```bash
# ML analysis only
npm run analyze:ml song.mp3

# Comprehensive (aubio + ML)
npm run analyze:full song.mp3
```

### Output Files

The ML analysis creates several files:
- `song.ml_analysis.json` - Main analysis results
- `song_stems/` - Separated audio stems (drums, bass, vocals, other)
- `song.transcribed.mid` - MIDI transcription
- `song.combined_analysis.json` - Combined aubio + ML results

## Features

### 1. Source Separation (Demucs)
Separates audio into individual stems:
```json
{
  "stems": {
    "drums": {
      "path": "song_stems/drums.wav",
      "features": {
        "tempo": 120,
        "onset_density": 5.2
      }
    },
    "bass": {
      "path": "song_stems/bass.wav",
      "features": {
        "has_pitched_content": true
      }
    }
  }
}
```

### 2. MIDI Transcription (Basic Pitch)
Converts audio to symbolic music:
```json
{
  "transcription": {
    "midi_path": "song.transcribed.mid",
    "note_count": 523,
    "pitch_range": {"min": 36, "max": 84},
    "notes": [
      {"pitch": 60, "start": 0.5, "duration": 0.25, "velocity": 0.8}
    ]
  }
}
```

### 3. Advanced Features
- **Tempo Detection**: More accurate than aubio alone
- **Key Detection**: Estimates musical key
- **Dynamic Analysis**: RMS, dynamic range in dB
- **Chord Recognition**: Basic harmonic analysis
- **Structure Detection**: Self-similarity based segmentation

### 4. Pattern Extraction
```json
{
  "patterns": {
    "rhythmic": {
      "common_intervals": [0.25, 0.5, 1.0],
      "tempo_stability": 0.02
    },
    "melodic": {
      "common_intervals": [2, 3, 5, 7],
      "pitch_range": {"min": 48, "max": 72}
    },
    "harmonic": {
      "common_chords": [0, 5, 7, 9],
      "chord_changes": 24
    }
  }
}
```

## Integration with StrudelCover

The combined analysis provides richer data for pattern generation:

1. **Accurate Tempo**: From multiple sources (aubio, librosa, stem analysis)
2. **Isolated Stems**: Generate patterns for each instrument separately
3. **MIDI Data**: Use actual notes for melodic patterns
4. **Harmonic Info**: Generate chord progressions matching the original

## Advanced Models (Optional)

For even better results, you can use:

### MusicGen (Meta)
```python
from audiocraft.models import MusicGen
model = MusicGen.get_pretrained('melody')
# Generate variations or continuations
```

### Wav2Vec2 Embeddings
Used for understanding musical similarity and structure.

## Troubleshooting

### PyTorch Installation
- **Apple Silicon**: Automatically uses MPS acceleration
- **Intel Mac/Linux**: Uses CPU version by default
- **CUDA**: Manually install CUDA version if you have NVIDIA GPU

### Memory Issues
Large audio files may require significant RAM. Solutions:
- Process in chunks
- Use smaller models
- Reduce sample rate

### Missing Dependencies
If `pip install` fails:
```bash
# Install system dependencies
brew install ffmpeg portaudio

# Try installing packages individually
pip install demucs
pip install basic-pitch
pip install librosa
```

## Performance

Typical analysis times (Apple M1):
- 3-minute song: ~45 seconds
- Source separation: ~20 seconds
- Transcription: ~10 seconds
- Feature extraction: ~15 seconds

## Future Enhancements

Planned additions:
- Real-time analysis during playback
- Genre classification
- Mood/emotion detection
- Instrument recognition
- Style transfer capabilities