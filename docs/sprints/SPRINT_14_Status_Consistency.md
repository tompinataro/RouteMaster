#!/usr/bin/env markdown
# Sprint 14 — Status Consistency (2h)

- Goal: Server is source of truth; client state restores consistently.
- Tasks:
  - On launch, fetch and show completed/in‑progress from server.
  - Reconcile local marks with server truth on every fetch.
- Acceptance:
  - Reinstall app → same ✓/in‑progress after initial fetch.
- Dependencies: Sprint 5
- Status: DONE
- Notes:
  - Client persists server truth to local storage when flags are present (completed/inProgress), ensuring offline screens reflect server truth.
  - Dev reset action clears local state when server is reset for demos.
