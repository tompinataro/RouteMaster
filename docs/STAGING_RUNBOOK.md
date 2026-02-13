#!/usr/bin/env markdown
# Staging Runbook

This runbook outlines how to bring up a staging API and point the mobile app at it for TestFlight/testing.

## 1) Provision the API
- Host: Heroku/Render/Fly/your choice
- Env vars required:
  - `PORT=5100`
  - `DATABASE_URL=postgres://...` (managed Postgres)
  - `JWT_SECRET=change-me`
  - `ADMIN_EMAIL=demo@example.com` (admin account)
- Build/Start:
  - `npm run build` (copies SQL)
  - `npm start` (runs `dist/server/server.js`)

## 2) Initialize DB
- Apply schema/seed (once):
  - `psql "$DATABASE_URL" -f server/sql/schema.sql`
  - `psql "$DATABASE_URL" -f server/sql/seed.sql`

## 3) Verify health
- `GET https://<staging-host>/health` → `{ ok: true }`
- `GET https://<staging-host>/api/routes/today` with a valid token → route list JSON

## 4) Point Mobile to staging
- In `mobile`, create a `.env` with:
```
EXPO_PUBLIC_API_URL=https://<staging-host>
```
- Or use script:
  - `npm run env:stage` (add script in mobile/package.json)

## 5) Test Admin reset (staging only)
- Obtain a token for admin user (email = `ADMIN_EMAIL`).
- `POST /api/admin/visit-state/reset` to clear today’s state.

## 6) Build TestFlight
- `eas build -p ios --profile staging` (internal testers)
- Or `eas build -p ios --profile production` (store-ready)
- `eas submit -p ios --latest` (or provide `--path <artifact>`) 

Notes
- The server implements dual‑write to `visit_state` and falls back to in‑memory when `DATABASE_URL` is not set.
- Client prefers server flags for completed/in‑progress, then falls back to local if absent.
