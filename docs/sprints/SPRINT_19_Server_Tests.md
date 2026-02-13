#!/usr/bin/env markdown
# Sprint 19 — Server Tests (2h)

- Goal: Vitest integration tests for server routes.
- Tasks:
  - Tests for auth, routes/today, visits/:id, submit, metrics, and guards.
  - Use in‑memory stubs when DB is absent; assert idempotency.
- Acceptance:
  - `npm run test` green; coverage acceptable for critical paths.
- Dependencies: Sprint 8
- Status: Completed

## Tests Added/Verified
- server/__tests__/server.spec.ts — health, auth login/me, routes today, in‑progress, submit idempotency.
- server/__tests__/auth_guards.spec.ts — 401 without token, 403 for non‑admin on admin routes.
- server/__tests__/state.spec.ts — server visit state flags (in‑memory mode) and admin reset.
- server/__tests__/admin.spec.ts — admin field‑tech assignment validation and graceful 404/500 without DB.
- server/__tests__/metrics.spec.ts — Prometheus metrics endpoint basics.

## Notes
- Tests avoid a real DB by relying on in‑memory fallbacks in server/data.ts when DATABASE_URL is unset.
- To run locally: `npm run test` (Vitest). Ensure DEMO_EMAIL/PASSWORD are set or rely on defaults in tests.
