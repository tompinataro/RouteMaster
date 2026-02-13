#!/usr/bin/env markdown
# Sprint 23 — App Store Release (2h)

- Goal: Submit the iOS app to the App Store.
- Tasks:
  - App Store Connect metadata: name, subtitle, description, screenshots, keywords, support URL, privacy policy URL.
  - App privacy: data collection disclosure (minimal; describe networking and analytics if any).
  - Icons/splash: confirm sizes (already in `mobile/assets`).
  - EAS submit workflow: production profile, bundle identifier, signing.
  - Versioning: bump version/build; tag release.
  - Final regression on production API.
- Acceptance:
  - Binary successfully submitted to App Review.
  - Release notes drafted and ready.
- Dependencies: Sprint 22, Sprint 5/8 (server truth), Sprint 21 (CI/CD)
- Status: In Progress — prepared store metadata doc and build numbers.

## Changes Implemented
- Set iOS `buildNumber` and Android `versionCode` in `mobile/app.json`.
- Added App Store metadata draft: `docs/release/APP_STORE_METADATA.md`.
- Added convenience scripts: `build:ios:staging`, `submit:ios:latest` in `mobile/package.json`.

## Operator Steps
1) Populate App Store Connect metadata using `docs/release/APP_STORE_METADATA.md`.
2) Ensure signing is configured (EAS will guide; use the existing bundle identifier `com.pinataro.bloomsteward`).
3) Build store binary: `cd mobile && npm run build:ios:prod`.
4) Submit latest build: `npm run submit:ios:latest`.
5) Fill App Privacy questionnaire (data collection/use as noted).
6) Attach screenshots; submit for review.

## Verification
- Smoke test TestFlight build on staging/prod API before submitting for review.
