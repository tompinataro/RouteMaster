#!/usr/bin/env markdown
# Sprint 9 — Queue Robustness (2h)

- Goal: Dedupe/backoff; never lose submissions; better telemetry.
- Tasks:
  - Add idempotency key; skip duplicates on server.
  - Exponential backoff and cap retries; store last error.
- Acceptance:
  - Flaky network test => eventual success with no duplicates.
- Dependencies: Sprint 5
- Status: DONE
- Notes:
  - Client queue dedupes by idempotency key `visitId:YYYY-MM-DD`.
  - Exponential backoff with cap; stores `attempts`, `nextTryAt`, `lastError`.
  - Subtle banner on RouteList when pending items exceed 3 attempts.
