# Store Build & Submit — Detailed Guide (Sprint 27)

Prereqs
- Apple Developer Program access and App Store Connect role with permission to submit apps
- EAS CLI installed (already via project devDeps) and `expo login` or `EXPO_TOKEN`
- Bundle ID: `com.pinataro.bloomsteward`

Build (Production)
```
cd mobile
# Optional: confirm API base for production in mobile/eas.json
cat mobile/eas.json | jq .build.production.env

# Build iOS production (store)
npm run build:ios:prod

# Track build status in the EAS UI link printed on completion
```

Submit to ASC
```
# Submit the latest successful iOS build
npm run submit:ios:latest

# You can pass non-interactive flags if using API key env vars:
#   EAS_APPLE_APP_SPECIFIC_PASSWORD, EAS_APPLE_APPLE_ID (for Apple ID auth)
# or App Store Connect API key via:
#   EXPO_APPLE_APP_STORE_CONNECT_ISSUER_ID, EXPO_APPLE_APP_STORE_CONNECT_KEY_ID, EXPO_APPLE_APP_STORE_CONNECT_PRIVATE_KEY
```

Finalize in App Store Connect
1) Select the uploaded build on the 1.0.1 version page
2) Paste What’s New; confirm metadata and screenshots
3) Complete App Privacy and Export Compliance
4) Submit for review

Notes
- First time signing: EAS can create and manage certificates and profiles automatically.
- Confirm `expo.version` (CFBundleShortVersionString) and `ios.buildNumber` in `mobile/app.json` match the version you’re submitting before kicking off the build.
- If you need to re-run with different credentials, use `eas credentials` to inspect/rotate.
- For 2FA prompts, prefer API Key auth to avoid interactive logins in CI.
