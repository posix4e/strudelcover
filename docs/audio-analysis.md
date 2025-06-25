# Audio Analysis with StrudelCover

StrudelCover can use pre-analyzed audio data to generate more accurate musical patterns that match your source audio's BPM and structure.

## Quick Start

1. Install aubio (audio analysis tool):
   ```bash
   brew install aubio
   ```

2. Analyze your audio file:
   ```bash
   ./scripts/analyze-with-aubio.sh song.mp3
   ```
   
   This creates `song.mp3.analysis.json` with BPM and structure data.

3. Run StrudelCover:
   ```bash
   npm run cover song.mp3 "Artist" "Song Name"
   ```
   
   StrudelCover will automatically detect and use the analysis file.

## What Gets Analyzed

The aubio analysis extracts:
- **BPM/Tempo**: Accurate beat detection for tempo matching
- **Song Structure**: Detected sections (intro, verse, chorus, bridge, outro)
- **Beat Positions**: Timing information for rhythmic accuracy
- **Onset Detection**: Musical event timing

## Analysis File Format

The generated `.analysis.json` file contains:

```json
{
  "bpm": 128,
  "duration": 240.5,
  "structure": {
    "intro": { "start": 0, "end": 15.2 },
    "verse1": { "start": 15.2, "end": 45.6 },
    "chorus1": { "start": 45.6, "end": 76.8 },
    ...
  }
}
```

## Benefits

- **Accurate Tempo**: Patterns match the original song's BPM
- **Proper Structure**: Musical sections align with the source
- **Better Transitions**: Changes happen at the right moments
- **No Hardcoding**: Works with any song, any genre

## Advanced Usage

For more detailed analysis, you can also use:
- [Essentia](https://essentia.upf.edu/) - Advanced music analysis
- [sonic-annotator](https://www.vamp-plugins.org/sonic-annotator/) - Plugin-based analysis
- Python's librosa library - Machine learning-based analysis

StrudelCover will automatically use any `.analysis.json` file it finds for your audio file.