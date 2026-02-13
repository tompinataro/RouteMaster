#!/usr/bin/env markdown
# Sprint 22 — Staging & TestFlight (2h)

- Goal: Deliver a staging environment and TestFlight (iOS) build for testers.
- Tasks:
  - Provision a staging API (Heroku/Render/Fly) with `DATABASE_URL`.
  - Configure Expo EAS project + profiles (staging/dev).
  - Build and distribute an iOS internal build to TestFlight.
  - Add staging `.env` for mobile (`EXPO_PUBLIC_API_URL=...`).
- Acceptance:
  - Testers install via TestFlight and run full flow successfully.
- Dependencies: Sprint 21 (CI/CD), Sprint 8 (DB enabled)
- Status: Completed — EAS profiles set, staging env documented
- Notes:
  - `mobile/eas.json` defines `preview` (internal), `staging` (internal channel=staging), and `production` (store) profiles.
  - API base for builds: `https://bloom-steward-2a872c497756.herokuapp.com`.
  - Added `mobile/.env.staging.example` and `npm run env:stage` script is available.

## Commands (Operator)
- Ensure Expo auth (in local shell or CI):
  - `expo login` (local) or use `EXPO_TOKEN` in CI
- Set staging env (local dev optional):
  - `cd mobile && npm run env:stage`
- Build internal (staging) iOS:
  - `eas build -p ios --profile staging`
- Distribute to TestFlight:
  - `eas submit -p ios` (or via EAS UI)

## Verification
- Install TestFlight build.
- Log in with demo creds; fetch today’s routes; open a visit; submit; verify server reflects state.
