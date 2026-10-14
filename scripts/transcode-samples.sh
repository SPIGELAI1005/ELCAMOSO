#!/bin/bash
# ELCAMOSO Sample Pack Transcode Script
# Converts WAV files to AAC/Opus/MP3 for reduced delivery size

set -e

# Default values
FORMAT="aac"
QUALITY="192"
INPUT_DIR=""
OUTPUT_DIR=""
PARALLEL_JOBS=4

show_help() {
  echo "ELCAMOSO Sample Pack Transcode Script"
  echo ""
  echo "Usage: $0 [options] <input-dir> <output-dir>"
  echo ""
  echo "Options:"
  echo "  -f, --format FORMAT    Output format: aac, opus, mp3 (default: aac)"
  echo "  -q, --quality QUALITY  Bitrate in kbps (default: 192)"
  echo "  -j, --jobs N           Parallel jobs (default: 4)"
  echo "  -h, --help             Show this help"
  echo ""
  echo "Examples:"
  echo "  $0 -f aac -q 192 ./sample-packs ./sample-packs-aac"
  echo "  $0 -f opus -q 128 ./sample-packs ./sample-packs-opus"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -f|--format)
      FORMAT="$2"
      shift 2
      ;;
    -q|--quality)
      QUALITY="$2"
      shift 2
      ;;
    -j|--jobs)
      PARALLEL_JOBS="$2"
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      if [ -z "$INPUT_DIR" ]; then
        INPUT_DIR="$1"
      elif [ -z "$OUTPUT_DIR" ]; then
        OUTPUT_DIR="$1"
      fi
      shift
      ;;
  esac
done

# Validate arguments
if [ -z "$INPUT_DIR" ] || [ -z "$OUTPUT_DIR" ]; then
  echo "Error: Input and output directories are required"
  show_help
  exit 1
fi

if ! command -v ffmpeg &> /dev/null; then
  echo "Error: ffmpeg is required but not installed"
  echo "Install with: brew install ffmpeg (macOS) or apt-get install ffmpeg (Ubuntu)"
  exit 1
fi

# Determine file extension and codec
case $FORMAT in
  aac)
    EXT="m4a"
    CODEC_OPTS="-c:a aac -b:a ${QUALITY}k"
    ;;
  opus)
    EXT="opus"
    CODEC_OPTS="-c:a libopus -b:a ${QUALITY}k"
    ;;
  mp3)
    EXT="mp3"
    CODEC_OPTS="-c:a libmp3lame -b:a ${QUALITY}k"
    ;;
  *)
    echo "Error: Unknown format '$FORMAT'. Use aac, opus, or mp3."
    exit 1
    ;;
esac

echo "ELCAMOSO Sample Pack Transcode"
echo "================================"
echo "Input:   $INPUT_DIR"
echo "Output:  $OUTPUT_DIR"
echo "Format:  $FORMAT ($EXT)"
echo "Quality: ${QUALITY}k"
echo "Jobs:    $PARALLEL_JOBS"
echo ""

# Create output directory structure
mkdir -p "$OUTPUT_DIR"

# Find all WAV files
WAV_FILES=$(find "$INPUT_DIR" -name "*.wav" -type f)
TOTAL_FILES=$(echo "$WAV_FILES" | wc -l | tr -d ' ')

echo "Found $TOTAL_FILES WAV files to convert"
echo ""

# Track progress
CONVERTED=0
FAILED=0

transcode_file() {
  local wav_file="$1"
  local rel_path="${wav_file#$INPUT_DIR/}"
  local dir_name=$(dirname "$rel_path")
  local base_name=$(basename "$rel_path" .wav)
  local out_dir="$OUTPUT_DIR/$dir_name"
  local out_file="$out_dir/${base_name}.${EXT}"
  
  mkdir -p "$out_dir"
  
  if [ -f "$out_file" ]; then
    echo "SKIP: $rel_path (exists)"
    return 0
  fi
  
  if ffmpeg -hide_banner -loglevel error -i "$wav_file" $CODEC_OPTS -y "$out_file" 2>/dev/null; then
    echo "OK:   $rel_path -> $base_name.$EXT"
    return 0
  else
    echo "FAIL: $rel_path"
    return 1
  fi
}

export -f transcode_file
export INPUT_DIR OUTPUT_DIR EXT CODEC_OPTS

# Run conversion with parallel jobs
echo "$WAV_FILES" | xargs -P "$PARALLEL_JOBS" -I {} bash -c 'transcode_file "$@"' _ {}

# Copy JSON manifests
echo ""
echo "Copying manifests..."
find "$INPUT_DIR" -name "*.json" -exec cp --parents {} "$OUTPUT_DIR" \; 2>/dev/null || \
find "$INPUT_DIR" -name "*.json" | while read f; do
  rel="${f#$INPUT_DIR/}"
  mkdir -p "$OUTPUT_DIR/$(dirname "$rel")"
  cp "$f" "$OUTPUT_DIR/$rel"
done

# Calculate size savings
INPUT_SIZE=$(du -sh "$INPUT_DIR" 2>/dev/null | cut -f1)
OUTPUT_SIZE=$(du -sh "$OUTPUT_DIR" 2>/dev/null | cut -f1)

echo ""
echo "================================"
echo "Transcode Complete"
echo "Input size:  $INPUT_SIZE"
echo "Output size: $OUTPUT_SIZE"
echo ""
echo "NOTE: You may need to update checksums in manifests if verifying transcoded files."
