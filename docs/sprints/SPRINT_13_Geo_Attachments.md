#!/usr/bin/env markdown
# Sprint 13 — Geo Attachments (2h)

- Goal: Attach check‑in/out location when permitted; safe fallbacks.
- Tasks:
  - Confirm permission flows; degrade gracefully.
  - Store lat/lng with submission; display subtle indicator.
- Acceptance:
  - Submissions include location or omit cleanly if unavailable.
- Dependencies: none
- Status: DONE
- Notes:
  - Requests foreground permission if needed; uses current position (balanced accuracy) with fallback to last known.
  - Check‑in payload includes `checkInLoc`; check‑out payload includes `checkOutLoc`.
