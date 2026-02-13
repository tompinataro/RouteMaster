#!/usr/bin/env markdown
# Sprint 3 — Error Handling (2h)

- Goal: Centralize API error display as banners; keep auto 401 sign‑out.
- Tasks:
  - Create a small error hook/handler for API calls → Banner.
  - Verify offline/timeout messages are user‑friendly.
  - Keep 401 handler that clears token/user and returns to Login.
- Acceptance:
  - Simulated 4xx/5xx show readable banners; no dead ends.
  - No raw JSON or stack traces leak to the UI.
- Dependencies: Sprint 1
- Status: DONE — GlobalBannerProvider + bus; all key screens use centralized banners; 401 auto sign-out preserved
