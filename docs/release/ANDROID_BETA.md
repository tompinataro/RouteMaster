## Android Beta — Internal Testing (Sprint 33)

Goal
- Upload an Android build to Google Play Console Internal testing and distribute to testers.

Prereqs
- Google Play Console access for your app package: `com.pinataro.bloomsteward` (see `mobile/app.json`)
- Service account with permission to upload to Play (JSON key file) or use interactive login
- EAS CLI authenticated (`expo login` or `EXPO_TOKEN` in CI)
 - Android Keystore: On first build, run interactively to generate or upload

Build
```
cd mobile
# Internal testing build (uses preview profile)
npm run build:android:internal
# or store-ready build
npm run build:android:prod
```

First-time credentials
- If prompted to generate Android Keystore, accept and EAS will manage it.
- After keystore is created once, CI/non-interactive builds will work.

Submit
```
# Submit the latest Android build to Play Console
npm run submit:android:latest

# Non-interactive (CI) options via env vars:
#   EAS_ANDROID_PACKAGE: com.pinataro.bloomsteward
# Service account JSON (recommended):
#   GOOGLE_SERVICE_ACCOUNT_JSON: '{"type":"service_account",...}'
# or provide a path: GOOGLE_SERVICE_ACCOUNT_JSON_PATH=/path/to/key.json
```

Play Console Setup
1) Create the app if not already present (package must match)
2) Upload the first AAB via internal testing track
3) Complete store listing basics (name, short desc, full desc)
4) App content: privacy, data safety (align with iOS), ads: No
5) Add internal testers (email group) and roll out

Smoke Test
- Install via Play Store link for internal testing
- Sign in; run Route List → Visit → Submit

Notes
- Align versionCode increments with `mobile/app.json` (currently 28)
- Keep EAS credentials managed; rotate service account key if needed
- For staging pointing, use `.env` or EAS `preview` env like on iOS
