set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
echo "branch: $(git rev-parse --abbrev-ref HEAD)"
git status --porcelain
git ls-files --error-unmatch mobile/src/components/AppSplash.tsx || true
sed -n '1,120p' mobile/src/components/AppSplash.tsx || true
if [ -f mobile/assets/palms.jpg ]; then
  if git show HEAD:mobile/assets/palms.jpg 2>/dev/null | sed -n '1,1' | grep -q 'version https://git-lfs.github.com/spec/v1'; then
    echo "Detected LFS pointer -> replacing with real image"
    cp mobile/assets/palms_splash.jpg /tmp/_palms.jpg
    mv mobile/assets/palms.jpg mobile/assets/palms.jpg.pointer.bak || true
    cp /tmp/_palms.jpg mobile/assets/palms.jpg
    git add -f mobile/assets/palms.jpg
    git commit -m "chore: replace LFS pointer with real palms.jpg for bundling" || true
    git push origin "$(git rev-parse --abbrev-ref HEAD)" || true
  else
    echo "palms.jpg appears to be a real file"
  fi
else
  echo "palms.jpg not present; skipping LFS replacement check"
fi
npx react-native bundle --entry-file index.ts --platform android --dev false --bundle-output /tmp/main.bundle --assets-dest /tmp/assets || true
ls -l /tmp/assets | sed -n '1,200p' || true
eas whoami || eas login
eas build --platform android --profile production --clear-cache
