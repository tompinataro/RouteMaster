#!/usr/bin/env markdown
# Sprint 10 — Foreground Sync (2h)

- Goal: Flush offline queue and refresh routes on app focus / network regain.
- Tasks:
  - Hook into AppState and NetInfo; call `flushQueue` + reload routes.
- Acceptance:
  - Returning to app with connectivity processes outstanding items < 1s.
- Dependencies: Sprint 9
- Status: DONE
- Notes:
  - On app foreground (`AppState === 'active'`), flush offline queue and refresh routes.
  - On Web, also refresh on `online` event.
  - See `mobile/src/screens/RouteListScreen.tsx` for hooks and `mobile/src/offlineQueue.ts` for queue flush.
