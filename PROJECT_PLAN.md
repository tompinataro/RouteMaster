# Bloom Steward — Project Plan (2‑Hour Sprints)

This plan tracks remaining work in concise, 2‑hour sprints. Each sprint has a clear goal, small task list, and acceptance criteria. Use the checklist to track progress; see individual sprint stubs in `docs/sprints/` for details.

## How To Use
- Each item below corresponds to a markdown stub in `docs/sprints/`.
- Mark checkboxes here as you complete sprints; update the matching stub with notes and status.

## Phase 1 — Stabilize & Hardening
- [x] Sprint 1: Remove Dev Artifacts (clean prod build, guard dev code)
- [x] Sprint 2: Navigation Polish (headers/back, iOS/Web parity)
- [x] Sprint 3: Error Handling (centralize banners; keep auto 401 sign‑out)
- [x] Sprint 4: Type Safety & Lint (tsc clean; basic ESLint)

## Phase 2 — Data & API
- [x] Sprint 5: Server Visit State (Phase A: in‑memory server truth now; Phase B: DB later; flags in `/api/routes/today`)
- [x] Sprint 6: Auth “Me” + Token Refresh (optional)
- [x] Sprint 7: Health/Metrics Polish (include version; counters)
 - [x] Sprint 8: DB Migrations (final schema + seed)

## Phase 3 — Offline & Sync
- [x] Sprint 9: Queue Robustness (dedupe/backoff; no lost submissions)
- [x] Sprint 10: Foreground Sync (focus/network regain)
 - [x] Sprint 11: Background Sync (optional background fetch)
 - [x] Sprint 12: Conflict Handling (double submit safety)
 - [x] Sprint 13: Geo Attachments (check‑in/out loc with fallbacks)
- [x] Sprint 14: Status Consistency (server as source of truth)

## Phase 4 — UX, A11y, Perf
- [x] Sprint 15: Accessibility Pass (labels/roles/hit areas; dynamic type)
- [x] Sprint 16: Micro‑Animations (map press state; ✓ polish; banner consistency)
- [x] Sprint 17: Performance (lazy load; prefetch; reduce re‑renders)
- [x] Sprint 18: Copy/Design Polish (final strings, spacing, colors)

## Phase 5 — Tests, CI, Release
- [x] Sprint 19: Server Tests (auth/routes/visits/submissions)
- [x] Sprint 20: Client Tests (key logic: time format, ack gates)
 - [x] Sprint 21: CI/CD (lint/test/build; EAS preview)
- [x] Sprint 22: Staging & TestFlight (staging env; tester flow)
- [ ] Sprint 23: App Store Release (App Store Connect metadata, EAS submit, review)

## Estimates
- 23 sprints × 2 hours ≈ 46 hours.
- +20% integration/QA buffer ≈ 55–58 hours.

## Hybrid DB Plan (Summary)
- Sprint 5 (Phase A): Implement server truth in memory with final API contract
  - GET `/api/routes/today` returns `completedToday`, `inProgress`.
  - POST `/api/visits/:id/in-progress` marks opened; `submit` marks completed.
- Sprint 8 (Phase B): Add DB table `visit_state (visit_id, date, user_id, status, created_at)`
  - Idempotent upserts; unique constraint `(visit_id, date, user_id)`.
  - Dual‑write and shadow‑read for one cycle; then flip reads to DB.
  - No client changes required.

## Notes
- Phases 3–4 items can run in parallel with Phase 2 as needed.
- High‑value fast track: Sprints 5, 9, 10, then 21.
