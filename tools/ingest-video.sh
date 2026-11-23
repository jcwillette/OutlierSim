#!/usr/bin/env bash
# Extract frames (and captions if available) from a game reveal / animation video.
#
#   tools/ingest-video.sh <video-file-or-URL> <game-id> [interval-seconds=3]
#
# URLs need yt-dlp (pip install yt-dlp) AND network access to the video host. Cloud sessions usually
# block YouTube: ask the user to upload the video file instead.
#
# Output (git-ignored): work/<game-id>/video/
#   video.*                 the video (if downloaded)
#   frames/t####.jpg        one frame every N seconds, named by second
#   scenes/s####.jpg        frames at scene changes; scenes/index.tsv maps file -> timestamp
#   sheets/sheet##.jpg      contact sheets of interval frames (16 per sheet, labeled by time)
#   captions.txt            plain-text captions/transcript when available
set -euo pipefail

src="${1:?usage: ingest-video.sh <video-file-or-URL> <game-id> [interval]}"
game="${2:?usage: ingest-video.sh <video-file-or-URL> <game-id> [interval]}"
interval="${3:-3}"
out="work/${game}/video"
mkdir -p "$out/frames" "$out/scenes" "$out/sheets"

if [[ "$src" =~ ^https?:// ]]; then
  if ! command -v yt-dlp >/dev/null; then
    echo "yt-dlp not installed. Try: pip install yt-dlp  (or ask the user to upload the video file)" >&2
    exit 2
  fi
  yt-dlp -f 'bv*[height<=720]+ba/b[height<=720]/b' --write-auto-subs --write-subs --sub-langs 'en.*' \
    --convert-subs srt -o "$out/video.%(ext)s" "$src"
  video=$(ls "$out"/video.* | grep -vE '\.(srt|vtt)$' | head -1)
else
  video="$src"
fi

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$video" | cut -d. -f1)
echo "Video: $video (${dur}s) -> $out"

# Interval frames, named by timestamp in seconds.
ffmpeg -v error -y -i "$video" -vf "fps=1/${interval},scale=960:-2" -q:v 3 "$out/frames/tmp_%05d.jpg"
i=0
for f in "$out"/frames/tmp_*.jpg; do
  mv "$f" "$out/frames/$(printf 't%04d' $((i * interval))).jpg"
  i=$((i + 1))
done

# Scene-change frames with timestamps.
ffmpeg -v info -y -i "$video" -vf "select='gt(scene,0.35)',showinfo,scale=960:-2" -vsync vfr -q:v 3 \
  "$out/scenes/s%04d.jpg" 2> "$out/scenes/ffmpeg.log" || true
{ grep -o 'pts_time:[0-9.]*' "$out/scenes/ffmpeg.log" || true; } | cut -d: -f2 |
  awk '{printf "s%04d.jpg\t%.1f\n", NR, $1}' > "$out/scenes/index.tsv"
rm -f "$out/scenes/ffmpeg.log"

# Contact sheets labeled by time for fast skimming.
if command -v montage >/dev/null; then
  ls "$out"/frames/t*.jpg | split -l 16 - "$out/sheets/list."
  k=0
  for l in "$out"/sheets/list.*; do
    k=$((k + 1))
    montage -label '%t' -pointsize 18 $(cat "$l") -tile 4x4 -geometry 480x270+4+4 "$out/sheets/$(printf 'sheet%02d' "$k").jpg"
    rm "$l"
  done
fi

# Captions -> plain text.
sub=$(ls "$out"/*.srt 2>/dev/null | head -1 || true)
if [[ -n "$sub" ]]; then
  grep -vE '^[0-9]+$|-->|^\s*$' "$sub" | awk '!seen[$0]++' > "$out/captions.txt"
  echo "  captions: $out/captions.txt"
else
  echo "  captions: none (no subtitle track). The manual is the source of truth; frames show layout and feel."
fi
echo "  frames:   $(ls "$out"/frames | wc -l) every ${interval}s; scenes: $(wc -l < "$out/scenes/index.tsv"); sheets: $(ls "$out"/sheets | wc -l)"
