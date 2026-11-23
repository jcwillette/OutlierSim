#!/usr/bin/env bash
# Turn a game manual PDF into things Claude can search and look at.
#
#   tools/ingest-manual.sh <manual.pdf> <game-id>            # full ingest
#   tools/ingest-manual.sh <manual.pdf> <game-id> --page 34  # render one page at high resolution
#
# Output (git-ignored): work/<game-id>/manual/
#   manual.txt            full text, layout preserved
#   pages/p###.txt        text per page (cite pages from these)
#   index.md              which pages mention each topic (scoring, timing, field, endgame, RP, fouls...)
#   headings.txt          numbered section headings with page numbers
#   thumbs/p###.png       every page at low resolution
#   sheets/sheet##.png    contact sheets of thumbnails (12 pages each) to spot drawings fast
#   hi/p###.png           pages rendered at high resolution (pages with figures + --page requests)
set -euo pipefail

pdf="${1:?usage: ingest-manual.sh <manual.pdf> <game-id> [--page N]}"
game="${2:?usage: ingest-manual.sh <manual.pdf> <game-id> [--page N]}"
out="work/${game}/manual"
mkdir -p "$out/pages" "$out/thumbs" "$out/sheets" "$out/hi"

if [[ "${3:-}" == "--page" ]]; then
  n="${4:?page number}"
  f=$(printf "p%03d" "$n")
  pdftoppm -r 150 -png -f "$n" -l "$n" -singlefile "$pdf" "$out/hi/$f"
  echo "$out/hi/$f.png"
  exit 0
fi

pages=$(pdfinfo "$pdf" | awk '/^Pages:/ {print $2}')
echo "Manual: $pdf ($pages pages) -> $out"

pdftotext -layout "$pdf" "$out/manual.txt"
for ((i = 1; i <= pages; i++)); do
  pdftotext -layout -f "$i" -l "$i" "$pdf" "$out/pages/$(printf 'p%03d' "$i").txt"
done

# Section headings like "6.4.2 SPEAKER" or "7 Game Rules" with their page.
: > "$out/headings.txt"
for f in "$out"/pages/p*.txt; do
  p=$(basename "$f" .txt)
  grep -E '^\s{0,4}[0-9]+(\.[0-9]+){0,3}\s+[A-Z][A-Za-z0-9 ,&/()-]{2,60}$' "$f" | sed "s/^ */$p  /" >> "$out/headings.txt" || true
done

# Topic index: pages ranked by keyword hits.
topic() {
  local name="$1" re="$2"
  echo "## $name"
  echo
  echo '`'"$re"'`'
  echo
  for f in "$out"/pages/p*.txt; do
    c=$(grep -ciE "$re" "$f" || true)
    if [[ "$c" -gt 0 ]]; then echo "$c $(basename "$f" .txt)"; fi
  done | sort -rn | head -12 | awk '{printf "- %s (%s hits)\n", $2, $1}'
  echo
}
{
  echo "# Manual topic index: $game"
  echo
  echo "Pages ranked by keyword hits. Read the top pages for each topic before extracting values."
  echo
  topic "Match timing" 'AUTO|TELEOP|seconds|match period|endgame|end game'
  topic "Scoring / point values" 'points?\b|point value|scored|scoring'
  topic "Ranking points & bonuses" 'ranking point|\bRP\b|bonus|coopertition'
  topic "Field dimensions & layout" 'dimension|\bin\.|\bft\b|field|carpet|perimeter'
  topic "Game pieces" 'game piece|diameter|weight|lb\.|staged|pre-?load'
  topic "Human player" 'human player|station|chute|feeder|inbound'
  topic "Endgame / climbing / parking" 'climb|hang|park|stage|cage|barge|chain|bar\b|tower'
  topic "Fouls & penalties" 'foul|tech foul|major|minor|penalt|yellow card'
  topic "Robot rules (size, height, extension)" 'frame perimeter|height|extension|bumper|weight'
  topic "Zones & areas" 'zone|area|line\b'
} > "$out/index.md"

# Low-res thumbnails of every page + contact sheets.
pdftoppm -r 30 -png "$pdf" "$out/thumbs/p"
# pdftoppm pads page numbers depending on page count; normalize to p###.png
for f in "$out"/thumbs/p-*.png; do
  n=$(basename "$f" .png | sed 's/^p-0*//')
  mv "$f" "$out/thumbs/$(printf 'p%03d' "$n").png"
done
if command -v montage >/dev/null; then
  ls "$out"/thumbs/p*.png | split -l 12 - "$out/sheets/list."
  k=0
  for l in "$out"/sheets/list.*; do
    k=$((k + 1))
    montage -label '%t' -pointsize 14 $(cat "$l") -tile 4x3 -geometry +6+6 "$out/sheets/$(printf 'sheet%02d' "$k").png"
    rm "$l"
  done
fi

# High-res render of figure pages: pages with figure captions (vector drawings) or real raster images.
# Images repeated on many pages (headers, logos) are ignored.
{
  grep -lE '(Figure|Table) [0-9]+[-.][0-9]+' "$out"/pages/p*.txt | sed -E 's#.*/p0*([0-9]+)\.txt#\1#'
  if command -v pdfimages >/dev/null; then
    pdfimages -list "$pdf" | awk 'NR > 2 && $4 > 300 && $5 > 200 {print $1, $4 "x" $5}' > "$out/.imgs"
    awk '{print $2}' "$out/.imgs" | sort | uniq -c | awk '$1 > 10 {print $2}' > "$out/.common"
    grep -vwFf "$out/.common" "$out/.imgs" | awk '{print $1}' || true
    rm -f "$out/.imgs" "$out/.common"
  fi
} | sort -un | while read -r n; do
  f=$(printf "p%03d" "$n")
  [[ -f "$out/hi/$f.png" ]] || pdftoppm -r 110 -png -f "$n" -l "$n" -singlefile "$pdf" "$out/hi/$f"
done

echo "Done."
echo "  text:     $out/manual.txt  (per page: $out/pages/)"
echo "  index:    $out/index.md   headings: $out/headings.txt"
echo "  sheets:   $(ls "$out"/sheets | wc -l) contact sheets in $out/sheets/"
echo "  figures:  $(ls "$out"/hi | wc -l) high-res pages in $out/hi/"
