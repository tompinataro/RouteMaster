#!/usr/bin/env markdown
# Sprint 11 — Background Sync (2h, optional)

- Goal: Use `expo-background-fetch` to flush occasionally in background.
- Tasks:
  - Register fetch task; guard with permissions and battery constraints.
- Acceptance:
  - Background task runs on simulator/device; safe no‑op when unavailable.
- Dependencies: Sprint 10
- Status: DONE
- Notes:
  - Background fetch task flushes offline queue and touches routes: `mobile/src/background.ts`.
  - Registered on app start (native only), iOS `UIBackgroundModes: ["fetch"]` set.
