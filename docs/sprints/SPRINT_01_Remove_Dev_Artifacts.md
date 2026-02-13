#!/usr/bin/env markdown
# Sprint 1 — Remove Dev Artifacts (2h)

- Goal: Ship a clean prod build; guard all dev‑only code under `__DEV__`.
- Tasks:
  - Remove temporary guards, logs, and test stubs not needed in prod.
  - Keep the header title reset behind `__DEV__` (no effect in prod).
  - Verify no unused imports/files remain.
- Acceptance:
  - `expo start --no-dev` runs without dev‑only UI or logs.
  - No red/yellow warnings in console for prod build.
- Dependencies: none
- Status: IN PROGRESS — dev helpers guarded by __DEV__ in headers; further cleanup pending
