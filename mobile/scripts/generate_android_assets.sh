#!/bin/zsh
# Generates Android launcher/playstore/feature graphic assets into mobile/assets
# Usage: ./generate_android_assets.sh
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS_DIR="$ROOT_DIR/assets"
ICON="$ASSETS_DIR/icon.png"
ADAPTIVE="$ASSETS_DIR/adaptive-icon-rgba.png"
BRAND="$ASSETS_DIR/brand-logo.png"
PLAYSTORE="$ASSETS_DIR/playstore-icon.png"
FEATURE="$ASSETS_DIR/feature-graphic.png"

echo "Assets dir: $ASSETS_DIR"

if [ ! -f "$ICON" ]; then
  echo "ERROR: source icon not found: $ICON" >&2
  exit 1
fi

# Helper to run ImageMagick convert when available, otherwise fallback to sips
has_convert() {
  command -v convert >/dev/null 2>&1
}

# Ensure assets dir exists
mkdir -p "$ASSETS_DIR"

# Create Play Store icon 512x512 (no alpha required) from icon.png
if has_convert; then
  echo "Using ImageMagick to produce playstore-icon.png"
  convert "$ICON" -resize 512x512^ -gravity center -background white -extent 512x512 "$PLAYSTORE"
else
  echo "ImageMagick not found; using sips to produce playstore-icon.png"
  sips -Z 512 "$ICON" --out "$PLAYSTORE"
fi

# Re-export adaptive icon foreground if missing
if [ -f "$ADAPTIVE" ]; then
  echo "Adaptive icon (RGBA) exists: $ADAPTIVE"
else
  echo "No adaptive icon-rgba found; re-exporting adaptive-icon.png -> adaptive-icon-rgba.png"
  if [ -f "$ASSETS_DIR/adaptive-icon.png" ]; then
    sips -s format png "$ASSETS_DIR/adaptive-icon.png" --out "$ADAPTIVE"
  else
    echo "No adaptive-icon.png to re-export; skipping" >&2
  fi
fi

# Create feature graphic 1024x500 (Play Console feature graphic)
if [ -f "$BRAND" ]; then
  if has_convert; then
    echo "Using ImageMagick to create feature-graphic.png"
    # Resize and crop/pad to exactly 1024x500
    convert "$BRAND" -resize 1400x700^ -gravity center -extent 1024x500 "$FEATURE"
  else
    echo "ImageMagick not found; using sips to approximate feature-graphic.png"
    sips -z 500 1024 "$BRAND" --out "$FEATURE"
  fi
else
  echo "No brand-logo.png found; attempting to create feature graphic from palms_full.png if available"
  if [ -f "$ASSETS_DIR/palms_full.png" ]; then
    if has_convert; then
      convert "$ASSETS_DIR/palms_full.png" -resize 1400x700^ -gravity center -extent 1024x500 "$FEATURE"
    else
      sips -z 500 1024 "$ASSETS_DIR/palms_full.png" --out "$FEATURE"
    fi
  else
    echo "No image available to create feature graphic; skipping" >&2
  fi
fi

# Generate simple mipmap-like launcher icons (square): mdpi hdpi xhdpi xxhdpi xxxhdpi
declare -A sizes=( [mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192 )
for density in "${(@k)sizes}"; do
  size=${sizes[$density]}
  out="$ASSETS_DIR/mipmap-${density}.png"
  if has_convert; then
    convert "$ICON" -resize ${size}x${size}^ -gravity center -background none -extent ${size}x${size} "$out"
  else
    sips -z ${size} ${size} "$ICON" --out "$out"
  fi
  echo "Wrote $out ($size x $size)"
done

# Summarize results
echo "\nGenerated assets in $ASSETS_DIR:"
ls -lh "$ASSETS_DIR" | egrep "playstore-icon|feature-graphic|adaptive-icon-rgba|mipmap-"

echo "Done. Use playstore-icon.png for Play Console (512x512, no alpha), feature-graphic.png for feature graphic (1024x500)."
