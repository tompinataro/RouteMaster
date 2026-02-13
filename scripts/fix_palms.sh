#!/bin/bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
# show key info
git rev-parse --abbrev-ref HEAD
git show HEAD:mobile/assets/palms.jpg 2>/dev/null | sed -n '1,3p' || echo "(missing in HEAD)"
git show origin/$(git rev-parse --abbrev-ref HEAD):mobile/assets/palms.jpg 2>/dev/null | sed -n '1,3p' || echo "(missing on remote)"
# replace LFS pointer if present
if git show HEAD:mobile/assets/palms.jpg 2>/dev/null | sed -n '1,1' | grep -q 'version https://git-lfs.github.com/spec/v1' 2>/dev/null; then
  cp mobile/assets/palms_splash.jpg /tmp/_palms.jpg
  mv mobile/assets/palms.jpg mobile/assets/palms.jpg.pointer.bak 2>/dev/null || true
  cp /tmp/_palms.jpg mobile/assets/palms.jpg
  git add -f mobile/assets/palms.jpg
  git commit -m "chore: add real palms.jpg for bundling" || true
  git push origin $(git rev-parse --abbrev-ref HEAD) || true
fi
# verify local bundling and run interactive EAS build
npx react-native bundle --entry-file index.ts --platform android --dev false --bundle-output /tmp/main.bundle --assets-dest /tmp/assets || true
ls -l /tmp/assets || true
eas whoami || eas login
eas build --platform android --profile production --clear-cache
