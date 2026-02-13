#!/usr/bin/env markdown
# Sprint 12 — Conflict Handling (2h)

- Goal: Safe merge/ignore of duplicate visit submissions.
- Tasks:
  - Idempotency at server based on visit+day.
  - Client shows friendly notice if already completed.
- Acceptance:
  - Submitting the same visit twice yields 200 idempotent or 409 with banner.
- Dependencies: Sprint 5, 9
- Status: DONE
- Notes:
  - Server checks `visit_state` for today (DB when present; fallback to memory) and returns `{ ok: true, idempotent: true }` without writing a duplicate submission.
  - Client: deduped offline queue and in-flight submit disabled prevents double taps.
