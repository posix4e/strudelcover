#!/bin/bash

# Comprehensive analysis combining aubio and ML approaches
# Usage: ./analyze-comprehensive.sh <audio-file> [output-dir]

set -e

if [ $# -lt 1 ]; then
    echo "Usage: $0 <audio-file> [output-dir]"
    echo "Example: $0 song.mp3 ./analysis"
    exit 1
fi

AUDIO_FILE="$1"
OUTPUT_DIR="${2:-.}"
BASENAME=$(basename "$AUDIO_FILE" | sed 's/\.[^.]*$//')

if [ ! -f "$AUDIO_FILE" ]; then
    echo "Error: Audio file not found: $AUDIO_FILE"
    exit 1
fi

echo "🎵 Comprehensive Audio Analysis Pipeline"
echo "========================================"
echo "Audio: $AUDIO_FILE"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# 1. Aubio Analysis
echo "1️⃣ Running Aubio Analysis..."
echo "------------------------"
AUBIO_OUTPUT="$OUTPUT_DIR/${BASENAME}.aubio_analysis.json"
if ./scripts/analyze-with-aubio.sh "$AUDIO_FILE" "$AUBIO_OUTPUT"; then
    echo "✅ Aubio analysis complete: $AUBIO_OUTPUT"
else
    echo "⚠️  Aubio analysis failed, continuing..."
fi

# 2. ML Analysis (if environment is set up)
echo ""
echo "2️⃣ Running ML Analysis..."
echo "----------------------"
ML_OUTPUT="$OUTPUT_DIR/${BASENAME}.ml_analysis.json"

if [ -f "venv/bin/activate" ]; then
    echo "Activating ML environment..."
    source venv/bin/activate
    
    if python scripts/analyze-with-ml.py "$AUDIO_FILE" -o "$ML_OUTPUT" 2>/dev/null; then
        echo "✅ ML analysis complete: $ML_OUTPUT"
    else
        echo "⚠️  ML analysis failed. Run ./scripts/setup-ml-env.sh to set up environment"
    fi
else
    echo "⚠️  ML environment not found. Run ./scripts/setup-ml-env.sh first"
fi

# 3. Combine Results
echo ""
echo "3️⃣ Combining Results..."
echo "--------------------"
COMBINED_OUTPUT="$OUTPUT_DIR/${BASENAME}.combined_analysis.json"

python3 - << EOF
import json
import sys
from pathlib import Path

combined = {
    "audio_file": "$AUDIO_FILE",
    "analyses": {}
}

# Load aubio results
aubio_path = Path("$AUBIO_OUTPUT")
if aubio_path.exists():
    with open(aubio_path) as f:
        combined["analyses"]["aubio"] = json.load(f)
        
# Load ML results
ml_path = Path("$ML_OUTPUT")
if ml_path.exists():
    with open(ml_path) as f:
        combined["analyses"]["ml"] = json.load(f)

# Extract key information for StrudelCover
if "aubio" in combined["analyses"]:
    aubio = combined["analyses"]["aubio"]
    combined["bpm"] = aubio.get("global_analysis", {}).get("bpm", 120)
    combined["duration"] = aubio.get("file_info", {}).get("duration", 180)
    combined["sections"] = aubio.get("sections", {})

# Override with ML data if available
if "ml" in combined["analyses"]:
    ml = combined["analyses"]["ml"]
    if "features" in ml:
        combined["bpm"] = ml["features"].get("tempo", combined.get("bpm", 120))
    if "structure" in ml:
        combined["ml_sections"] = ml["structure"].get("sections", [])
    if "stems" in ml:
        combined["stems"] = {k: v["path"] for k, v in ml["stems"].items()}
    if "transcription" in ml:
        combined["midi_file"] = ml["transcription"]["midi_path"]
        combined["note_count"] = ml["transcription"]["note_count"]

# Save combined results
with open("$COMBINED_OUTPUT", 'w') as f:
    json.dump(combined, f, indent=2)
    
print(f"✅ Combined analysis saved to: $COMBINED_OUTPUT")

# Print summary
print("\n📊 Analysis Summary:")
print("=" * 50)
print(f"BPM: {combined.get('bpm', 'Unknown')}")
print(f"Duration: {combined.get('duration', 'Unknown')}s")
if "stems" in combined:
    print(f"Stems: {', '.join(combined['stems'].keys())}")
if "midi_file" in combined:
    print(f"MIDI transcription: {combined['midi_file']}")
print(f"Sections: {len(combined.get('sections', {}))}")
EOF

echo ""
echo "✅ Comprehensive analysis complete!"
echo ""
echo "Output files:"
ls -la "$OUTPUT_DIR/${BASENAME}".*.json 2>/dev/null | awk '{print "  - " $9}'
echo ""
echo "Use the combined analysis for StrudelCover:"
echo "  npm run cover \"$AUDIO_FILE\" \"Artist\" \"Song\""