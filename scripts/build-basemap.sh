#!/usr/bin/env bash
# build-basemap.sh — Build the self-hosted basemap and publish it to Supabase Storage.
#
# Usage:
#   ./scripts/build-basemap.sh              # build + upload tiles and glyphs
#   ./scripts/build-basemap.sh --tiles      # only the .pmtiles archive
#   ./scripts/build-basemap.sh --fonts      # only the glyphs
#   ./scripts/build-basemap.sh --dry-run    # build locally, upload nothing
#
# Why this exists: the map used to read from OpenFreeMap, a free service with no
# SLA run by one person. When it was unreachable the map turned into a flat
# rectangle with the pins floating on it and no explanation. We now host the
# basemap ourselves, in the Supabase project we already pay for.
#
# It is far cheaper than it sounds. `pmtiles extract` clips a bounding box out
# of the 128 GB planet build over HTTP range requests WITHOUT downloading it:
# the Roßdorf work area is 3.5 MB and takes 11 seconds. Add a ZONE below when a
# new project area opens and re-run — there is no reason to ever ship Germany.
#
# Requires: pmtiles CLI (https://github.com/protomaps/go-pmtiles/releases),
#           SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.

set -euo pipefail

BUCKET="basemap"
ARCHIVE="de-zonas.pmtiles"
FONTSTACK="Noto Sans Regular"
ASSETS="https://raw.githubusercontent.com/protomaps/basemaps-assets/main/fonts"

# ── Work areas ───────────────────────────────────────────────────────────────
# One line per project area: "NAME west,south,east,north" (WGS84).
# Keep the boxes tight — every extra square kilometre is bytes the technician
# downloads in the field for ground nobody is digging.
ZONES=(
  "rossdorf   8.72,49.83,8.81,49.89"   # QFF — Roßdorf
  "hoexter    9.31,51.74,9.45,51.81"   # HXT — Höxter
)

MODE="${1:-all}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

need() { command -v "$1" >/dev/null || { echo "❌ $1 not found — $2"; exit 1; }; }
need pmtiles "install from https://github.com/protomaps/go-pmtiles/releases"
need curl "should ship with macOS"

if [[ "$MODE" != "--dry-run" ]]; then
  : "${SUPABASE_URL:?set SUPABASE_URL}"
  : "${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"
fi

# Upload one file, replacing whatever is there. `upsert` matters: this script is
# re-run every time a work area is added, and the app reads a fixed URL.
upload() {
  local file="$1" dest="$2"
  if [[ "$MODE" == "--dry-run" ]]; then
    echo "   (dry-run) would upload $dest"
    return
  fi
  curl -fsS -X POST "$SUPABASE_URL/storage/v1/object/$BUCKET/$dest" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "x-upsert: true" \
    --data-binary "@$file" -o /dev/null
}

# ── Tiles ────────────────────────────────────────────────────────────────────
if [[ "$MODE" == "all" || "$MODE" == "--tiles" || "$MODE" == "--dry-run" ]]; then
  # The daily planet build. Yesterday's, because today's may not be published
  # yet depending on the hour — the data is OSM, a day makes no difference.
  BUILD="https://build.protomaps.com/$(date -u -v-1d +%Y%m%d).pmtiles"
  echo "▶ planet build: $BUILD"

  # All zones in ONE extract, as a MultiPolygon. Not one archive per zone
  # merged afterwards: every extract necessarily contains the same world
  # overview tiles, so `pmtiles merge` rejects them as overlapping.
  {
    printf '{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":['
    sep=""
    for zone in "${ZONES[@]}"; do
      name="${zone%% *}"
      IFS=, read -r w s e n <<<"${zone##* }"
      echo "▶ zone $name ($w,$s,$e,$n)" >&2
      printf '%s[[[%s,%s],[%s,%s],[%s,%s],[%s,%s],[%s,%s]]]' \
        "$sep" "$w" "$s" "$e" "$s" "$e" "$n" "$w" "$n" "$w" "$s"
      sep=","
    done
    printf ']}}'
  } >"$WORK/zones.geojson"

  pmtiles extract "$BUILD" "$WORK/$ARCHIVE" --region="$WORK/zones.geojson" --quiet

  echo "▶ archive: $(du -h "$WORK/$ARCHIVE" | cut -f1)"
  upload "$WORK/$ARCHIVE" "$ARCHIVE"
fi

# ── Glyphs ───────────────────────────────────────────────────────────────────
# Without these the labels vanish and the map is a set of unnamed streets, so
# they are as much a dependency as the tiles. 256 files, ~6 MB, uploaded once.
if [[ "$MODE" == "all" || "$MODE" == "--fonts" || "$MODE" == "--dry-run" ]]; then
  echo "▶ glyphs: $FONTSTACK"
  encoded="${FONTSTACK// /%20}"
  for start in $(seq 0 256 65280); do
    range="$start-$((start + 255))"
    if curl -fsS "$ASSETS/$encoded/$range.pbf" -o "$WORK/glyph.pbf" 2>/dev/null; then
      upload "$WORK/glyph.pbf" "fonts/$FONTSTACK/$range.pbf"
    fi
  done
  echo "▶ glyphs done"
fi

if [[ "$MODE" == "--dry-run" ]]; then
  echo "✅ basemap built (nothing uploaded)"
else
  echo "✅ basemap published to the '$BUCKET' bucket"
fi
