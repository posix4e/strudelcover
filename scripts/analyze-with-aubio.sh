#!/bin/bash

# Comprehensive audio analysis using aubio tools
# Usage: ./analyze-with-aubio.sh <audio-file> [output-file]

set -e

if [ $# -lt 1 ]; then
    echo "Usage: $0 <audio-file> [output-file]"
    echo "Example: $0 song.mp3 song.analysis.json"
    exit 1
fi

AUDIO_FILE="$1"
OUTPUT_FILE="${2:-${AUDIO_FILE}.analysis.json}"
TEMP_DIR="/tmp/aubio_analysis_$$"

if [ ! -f "$AUDIO_FILE" ]; then
    echo "Error: Audio file not found: $AUDIO_FILE"
    exit 1
fi

# Check if aubio is installed
if ! command -v aubio &> /dev/null; then
    echo "Error: aubio is not installed"
    echo "Please install it with: brew install aubio"
    exit 1
fi

# Check if ffprobe is installed
if ! command -v ffprobe &> /dev/null; then
    echo "Error: ffprobe is not installed"
    echo "Please install it with: brew install ffmpeg"
    exit 1
fi

# Create temp directory
mkdir -p "$TEMP_DIR"

echo "🎵 Comprehensive Audio Analysis: $AUDIO_FILE"
echo "================================================"

# Get basic file info
echo "📊 Extracting file information..."
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$AUDIO_FILE" 2>/dev/null || echo "180")
SAMPLE_RATE=$(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of default=noprint_wrappers=1:nokey=1 "$AUDIO_FILE" 2>/dev/null || echo "44100")
BIT_RATE=$(ffprobe -v error -show_entries format=bit_rate -of default=noprint_wrappers=1:nokey=1 "$AUDIO_FILE" 2>/dev/null || echo "128000")

# Get tempo/BPM
echo "⏱️  Detecting tempo..."
BPM_RAW=$(aubio tempo "$AUDIO_FILE" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+' | head -1 || echo "120.0")
BPM=$(echo "$BPM_RAW" | cut -d. -f1)

# Get all beat positions
echo "🥁 Detecting beats..."
aubio beat "$AUDIO_FILE" 2>/dev/null > "$TEMP_DIR/beats.txt" || echo ""
BEAT_COUNT=$(wc -l < "$TEMP_DIR/beats.txt")

# Get onset times (start of musical events)
echo "🎼 Detecting onsets..."
aubio onset "$AUDIO_FILE" 2>/dev/null > "$TEMP_DIR/onsets.txt" || echo ""
ONSET_COUNT=$(wc -l < "$TEMP_DIR/onsets.txt")

# Get pitch information
echo "🎵 Detecting pitch variations..."
aubio pitch "$AUDIO_FILE" 2>/dev/null > "$TEMP_DIR/pitch.txt" || echo ""

# Analyze different sections of the song
echo "📍 Analyzing song sections..."

# Function to analyze a section
analyze_section() {
    local start=$1
    local duration=$2
    local section_name=$3
    local temp_file="$TEMP_DIR/${section_name}.wav"
    
    # Extract section
    ffmpeg -i "$AUDIO_FILE" -ss "$start" -t "$duration" -ar 44100 -ac 1 "$temp_file" -y 2>/dev/null
    
    # Get section tempo
    local section_bpm=$(aubio tempo "$temp_file" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+' | head -1 || echo "$BPM_RAW")
    
    # Get onset density (energy indicator)
    local section_onsets=$(aubio onset "$temp_file" 2>/dev/null | wc -l)
    local onset_density=$(echo "scale=2; $section_onsets / $duration" | bc -l | sed 's/^\./0./')
    
    # Get average pitch
    local avg_pitch=$(aubio pitch "$temp_file" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+' | awk '{sum+=$1; count++} END {if(count>0) print sum/count; else print 0}')
    
    # Get dynamic range (using RMS)
    local rms_info=$(ffmpeg -i "$temp_file" -af "volumedetect" -f null - 2>&1 | grep -E "mean_volume|max_volume" || echo "")
    local mean_vol=$(echo "$rms_info" | grep "mean_volume" | grep -oE "[-0-9.]+ dB" | grep -oE "[-0-9.]+" || echo "-20")
    local max_vol=$(echo "$rms_info" | grep "max_volume" | grep -oE "[-0-9.]+ dB" | grep -oE "[-0-9.]+" || echo "-10")
    
    # Clean up section file
    rm -f "$temp_file"
    
    echo "{
        \"bpm\": $(echo "$section_bpm" | cut -d. -f1),
        \"onset_density\": $onset_density,
        \"avg_pitch\": ${avg_pitch:-0},
        \"mean_volume\": $mean_vol,
        \"max_volume\": $max_vol,
        \"energy\": \"$(if (( $(echo "$onset_density > 5" | bc -l) )); then echo "high"; elif (( $(echo "$onset_density > 2" | bc -l) )); then echo "medium"; else echo "low"; fi)\"
    }"
}

# Define section timings based on song length
SECTION_LENGTH=$(echo "scale=2; $DURATION / 8" | bc -l)

# Analyze 8 sections throughout the song
# Using separate variables for compatibility
INTRO_START=0
INTRO_DUR=$(echo "scale=2; $SECTION_LENGTH * 0.5" | bc -l)
VERSE1_START=$(echo "scale=2; $SECTION_LENGTH * 0.5" | bc -l)
VERSE1_DUR=$SECTION_LENGTH
CHORUS1_START=$(echo "scale=2; $SECTION_LENGTH * 1.5" | bc -l)
CHORUS1_DUR=$SECTION_LENGTH
VERSE2_START=$(echo "scale=2; $SECTION_LENGTH * 2.5" | bc -l)
VERSE2_DUR=$SECTION_LENGTH
CHORUS2_START=$(echo "scale=2; $SECTION_LENGTH * 3.5" | bc -l)
CHORUS2_DUR=$SECTION_LENGTH
BRIDGE_START=$(echo "scale=2; $SECTION_LENGTH * 4.5" | bc -l)
BRIDGE_DUR=$(echo "scale=2; $SECTION_LENGTH * 0.75" | bc -l)
CHORUS3_START=$(echo "scale=2; $SECTION_LENGTH * 5.25" | bc -l)
CHORUS3_DUR=$SECTION_LENGTH
OUTRO_START=$(echo "scale=2; $SECTION_LENGTH * 6.25" | bc -l)
OUTRO_DUR=$(echo "scale=2; $DURATION - $SECTION_LENGTH * 6.25" | bc -l)

# Detect quiet sections (for better structure detection)
echo "🔇 Detecting quiet sections..."
aubio quiet "$AUDIO_FILE" -s -50 2>/dev/null > "$TEMP_DIR/quiet.txt" || echo ""

# Create comprehensive JSON output
echo "💾 Generating analysis file..."

cat > "$OUTPUT_FILE" << EOF
{
  "file_info": {
    "duration": $DURATION,
    "sample_rate": $SAMPLE_RATE,
    "bit_rate": $BIT_RATE
  },
  "global_analysis": {
    "bpm": $BPM,
    "beats_count": $BEAT_COUNT,
    "onsets_count": $ONSET_COUNT,
    "beats_per_minute": $BPM,
    "beats_per_second": $(echo "scale=2; $BEAT_COUNT / $DURATION" | bc -l | sed 's/^\./0./'),
    "onsets_per_second": $(echo "scale=2; $ONSET_COUNT / $DURATION" | bc -l | sed 's/^\./0./')
  },
  "sections": {
EOF

# Analyze each section
FIRST=true
for section in intro verse1 chorus1 verse2 chorus2 bridge chorus3 outro; do
    if [ "$FIRST" = true ]; then
        FIRST=false
    else
        echo "," >> "$OUTPUT_FILE"
    fi
    
    # Get section timing based on name
    case "$section" in
        "intro") start=$INTRO_START; duration=$INTRO_DUR ;;
        "verse1") start=$VERSE1_START; duration=$VERSE1_DUR ;;
        "chorus1") start=$CHORUS1_START; duration=$CHORUS1_DUR ;;
        "verse2") start=$VERSE2_START; duration=$VERSE2_DUR ;;
        "chorus2") start=$CHORUS2_START; duration=$CHORUS2_DUR ;;
        "bridge") start=$BRIDGE_START; duration=$BRIDGE_DUR ;;
        "chorus3") start=$CHORUS3_START; duration=$CHORUS3_DUR ;;
        "outro") start=$OUTRO_START; duration=$OUTRO_DUR ;;
    esac
    
    end=$(echo "$start + $duration" | bc -l)
    
    echo -n "    \"$section\": {
      \"start\": $start,
      \"end\": $end,
      \"duration\": $duration,
      \"analysis\": $(analyze_section "$start" "$duration" "$section")
    }" >> "$OUTPUT_FILE"
done

# Close sections object
echo "" >> "$OUTPUT_FILE"
echo "  }," >> "$OUTPUT_FILE"

# Add beat grid information
echo "  \"beat_grid\": {" >> "$OUTPUT_FILE"
echo "    \"first_10_beats\": [" >> "$OUTPUT_FILE"
if [ -s "$TEMP_DIR/beats.txt" ]; then
    head -10 "$TEMP_DIR/beats.txt" | awk '{printf "%s,", $1}' | sed 's/,$//' | sed 's/^/      /' >> "$OUTPUT_FILE"
else
    echo -n "      " >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"
echo "    ]," >> "$OUTPUT_FILE"
echo "    \"beat_intervals\": [" >> "$OUTPUT_FILE"

# Calculate intervals between beats
if [ -s "$TEMP_DIR/beats.txt" ]; then
    awk 'NR>1{print $1-prev} {prev=$1}' "$TEMP_DIR/beats.txt" | head -20 | awk '{printf "%s,", $1}' | sed 's/,$//' | sed 's/^/      /' >> "$OUTPUT_FILE"
else
    echo -n "      " >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"
echo "    ]" >> "$OUTPUT_FILE"
echo "  }," >> "$OUTPUT_FILE"

# Add onset patterns
echo "  \"onset_patterns\": {" >> "$OUTPUT_FILE"
echo "    \"first_20_onsets\": [" >> "$OUTPUT_FILE"
if [ -s "$TEMP_DIR/onsets.txt" ]; then
    head -20 "$TEMP_DIR/onsets.txt" | awk '{printf "%s,", $1}' | sed 's/,$//' | sed 's/^/      /' >> "$OUTPUT_FILE"
else
    echo -n "      " >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"
echo "    ]" >> "$OUTPUT_FILE"
echo "  }," >> "$OUTPUT_FILE"

# Add metadata
echo "  \"analysis_metadata\": {" >> "$OUTPUT_FILE"
echo "    \"tool\": \"aubio\"," >> "$OUTPUT_FILE"
echo "    \"version\": \"comprehensive\"," >> "$OUTPUT_FILE"
echo "    \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"" >> "$OUTPUT_FILE"
echo "  }" >> "$OUTPUT_FILE"
echo "}" >> "$OUTPUT_FILE"

# Clean up
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Comprehensive analysis complete!"
echo "📊 Summary:"
echo "  - Duration: ${DURATION}s"
echo "  - BPM: $BPM"
echo "  - Beats: $BEAT_COUNT"
echo "  - Onsets: $ONSET_COUNT"
echo "  - Sections analyzed: 8"
echo "  - Output: $OUTPUT_FILE"
echo ""
echo "💡 The analysis includes:"
echo "  - Per-section BPM variations"
echo "  - Energy levels for each section"
echo "  - Beat grid and timing information"
echo "  - Onset patterns for rhythm detection"
echo "  - Volume dynamics per section"