#!/usr/bin/env bash
set -euo pipefail

# Capture iOS App Store screenshots from simulators with consistent status bar.
# - Boots iPhone 15 Pro Max (6.7") and iPhone 8 Plus (5.5").
# - Applies clean status bar.
# - Prompts you to navigate to each screen; press Enter to capture.
# - Saves to docs/release/SCREENSHOTS/.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
OUT_DIR="$ROOT_DIR/docs/release/SCREENSHOTS"
mkdir -p "$OUT_DIR"

DEVICE_67="iPhone 15 Pro Max"   # 6.7"
DEVICE_55="iPhone 8 Plus"        # 5.5"

SCREENS=(login routes visit)

function udid_for() {
  local name="$1"
  xcrun simctl list devices | awk -v n="$name" -F '[()]' '$0 ~ n {print $2; exit}'
}

function boot_device() {
  local name="$1"
  echo "-> Booting: $name"
  xcrun simctl boot "$name" >/dev/null 2>&1 || true
  # Wait until booted
  for i in {1..60}; do
    state=$(xcrun simctl list devices | grep "$name (" | sed -E 's/.*\(([^)]*)\).*/\1/')
    if [[ "$state" == *"Booted"* ]]; then break; fi
    sleep 1
  done
}

function clean_statusbar() {
  local udid="$1"
  echo "-> Setting status bar (udid=$udid)"
  xcrun simctl status_bar "$udid" override \
    --time 9:41 \
    --dataNetwork wifi \
    --wifiBars 3 \
    --cellularMode active \
    --cellularBars 4 \
    --batteryState charged \
    --batteryLevel 100 || true
}

function screenshot_prompts() {
  local udid="$1"
  local tag="$2"
  for screen in "${SCREENS[@]}"; do
    read -r -p "Navigate $tag simulator to screen: '$screen' then press Enter to capture..." _
    local path="$OUT_DIR/iphone-${tag}-${screen}.png"
    echo "-> Capturing $path"
    xcrun simctl io "$udid" screenshot "$path" --type=png
  done
}

echo "Output directory: $OUT_DIR"

boot_device "$DEVICE_67"
boot_device "$DEVICE_55"

UDID_67=$(udid_for "$DEVICE_67")
UDID_55=$(udid_for "$DEVICE_55")

clean_statusbar "$UDID_67"
clean_statusbar "$UDID_55"

echo "\nNow open your app in each simulator. If using an Expo Dev Client, keep 'npx expo start --dev-client --tunnel' running.\n"

screenshot_prompts "$UDID_67" "6.7"
screenshot_prompts "$UDID_55" "5.5"

echo "\nAll screenshots saved to: $OUT_DIR\n"

