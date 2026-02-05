#!/usr/bin/env markdown
# Sprint 6 — Auth “Me” + Refresh (2h)

- Goal: Add `/api/auth/me` and (optional) short token refresh/extend.
- Tasks:
  - Add `/api/auth/me` returning user and token validity.
  - Consider extending token expiry on activity (or refresh endpoint).
- Acceptance:
  - App restores session without immediate 401; `me` endpoint passes.
- Dependencies: none
- Status: DONE
- Notes:
  - `/api/auth/me` returns current user.
  - `/api/auth/refresh` issues a fresh token when the current one is valid.
  - Client refreshes token on startup and whenever the app returns to foreground.
