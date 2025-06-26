#!/bin/bash
# Simple audio analysis script using aubio tools
# This creates a basic analysis JSON file for StrudelCover

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <audio_file>"
    exit 1
fi

AUDIO_FILE="$1"
OUTPUT_FILE="${AUDIO_FILE%.*}.analysis.json"

if [ ! -f "$AUDIO_FILE" ]; then
    echo "Error: Audio file not found: $AUDIO_FILE"
    exit 1
fi

echo "Analyzing $AUDIO_FILE..."

# Check if aubio tools are available
if ! command -v aubiotempo &> /dev/null; then
    echo "Warning: aubio not found. Creating minimal analysis."
    echo '{
  "tempo": 120,
  "beats": [],
  "onset_times": [],
  "duration": 180,
  "source": "fallback"
}' > "$OUTPUT_FILE"
    echo "Basic analysis saved to $OUTPUT_FILE"
    exit 0
fi

# Get tempo
TEMPO=$(aubiotempo "$AUDIO_FILE" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1 || echo "120")

# Get onset times (limited to first 100)
ONSETS=$(aubioonset "$AUDIO_FILE" 2>/dev/null | head -100 | tr '\n' ',' | sed 's/,$//' || echo "")

# Get duration using ffprobe if available
DURATION="180"
if command -v ffprobe &> /dev/null; then
    DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$AUDIO_FILE" 2>/dev/null || echo "180")
fi

# Create JSON output
cat > "$OUTPUT_FILE" << EOF
{
  "tempo": ${TEMPO:-120},
  "onset_times": [${ONSETS}],
  "duration": ${DURATION},
  "source": "aubio",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "Analysis saved to $OUTPUT_FILE"