#!/bin/zsh
# Generate Android resource folders suitable for copying into a native Android project
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS_DIR="$ROOT_DIR/assets"
OUT_DIR="$ROOT_DIR/android-res"

echo "Using assets: $ASSETS_DIR"
mkdir -p "$OUT_DIR"

# densities mapping
typeset -A sizes=( [mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192 )

for density in "${(@k)sizes}"; do
  size=${sizes[$density]}
  folder="$OUT_DIR/mipmap-${density}"
  mkdir -p "$folder"
  src="$ASSETS_DIR/mipmap-${density}.png"
  if [ -f "$src" ]; then
    cp "$src" "$folder/ic_launcher.png"
    cp "$src" "$folder/ic_launcher_round.png"
    echo "Wrote $folder/ic_launcher.png ($size)"
  else
    echo "Warning: $src not found; skipping $density" >&2
  fi
done

# Create mipmap-anydpi-v26 with adaptive icon xml and foreground/background
MIPMAP_ANY="$OUT_DIR/mipmap-anydpi-v26"
mkdir -p "$MIPMAP_ANY"

# Copy adaptive foreground into mipmap-anydpi-v26 as ic_launcher_foreground.png
if [ -f "$ASSETS_DIR/adaptive-icon-rgba.png" ]; then
  cp "$ASSETS_DIR/adaptive-icon-rgba.png" "$MIPMAP_ANY/ic_launcher_foreground.png"
  echo "Copied adaptive foreground to $MIPMAP_ANY/ic_launcher_foreground.png"
elif [ -f "$ASSETS_DIR/adaptive-icon.png" ]; then
  cp "$ASSETS_DIR/adaptive-icon.png" "$MIPMAP_ANY/ic_launcher_foreground.png"
  echo "Copied adaptive-icon.png to $MIPMAP_ANY/ic_launcher_foreground.png"
else
  echo "No adaptive icon found to copy to mipmap-anydpi-v26" >&2
fi

# Background: use app.json color if present, otherwise white
BACKGROUND_COLOR="#e7bfbf"
if [ -f "$ROOT_DIR/app.json" ]; then
  # try to read android.adaptiveIcon.backgroundColor from app.json
  bg=$(cat "$ROOT_DIR/app.json" | grep -o 'backgroundColor" *: *"#[0-9a-fA-F]\{6\}"' | head -n1 | sed 's/.*:\s*"\(#[0-9A-Fa-f]\{6\}\)"/\1/') || true
  if [ -n "$bg" ]; then
    BACKGROUND_COLOR="$bg"
  fi
fi

cat > "$MIPMAP_ANY/ic_launcher_background.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
EOF

# Create values/colors.xml with launcher_background
VALUES_DIR="$OUT_DIR/values"
mkdir -p "$VALUES_DIR"
cat > "$VALUES_DIR/colors.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="launcher_background">$BACKGROUND_COLOR</color>
</resources>
EOF

echo "Generated android resources under: $OUT_DIR"
ls -la "$OUT_DIR" | sed -n '1,200p'

echo "Note: copy the contents of $OUT_DIR into your Android project's res/ directory (merge mipmap-* and values/)."
