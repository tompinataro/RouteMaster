#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "safe script running from $(pwd)"

# example verification + build steps (edit as needed)
npx react-native bundle --entry-file index.ts --platform android --dev false \
  --bundle-output /tmp/main.bundle --assets-dest /tmp/assets || true
echo "---- /tmp/assets ----"
ls -l /tmp/assets | sed -n '1,200p' || true

# interactive EAS build (will prompt to login/confirm SDK warning)
eas whoami || eas login
eas build --platform android --profile production --clear-cache
