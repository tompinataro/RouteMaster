#!/usr/bin/env markdown
#!/usr/bin/env markdown
# Sprint 8 — DB Migrations (2h)

- Goal: Persist visit state in DB and keep the API identical to Phase A.
- Tasks:
  - Create table `visit_state (visit_id int, date date, user_id int, status text check(status in ('in_progress','completed')), created_at timestamptz default now(), primary key (visit_id, date, user_id))`.
  - Add upsert helpers in server to mark in‑progress/completed idempotently.
  - Dual‑write: keep the in‑memory map for one cycle while writing to DB.
  - Shadow‑read: compare DB vs map once; then flip reads to DB.
- Acceptance:
  - With `DATABASE_URL` set, server uses DB; client unchanged.
  - Reinstall client → fetch → ✓/in‑progress restored from DB.
- Dependencies: Sprint 5
- Status: DONE
- Notes:
  - Schema and seed in `server/sql` applied by release script when `DATABASE_URL` is set.
  - Dual-write on in-progress/completed; reads default to DB when available.
  - Shadow read mode compares DB vs memory once/day and now auto-flips to DB reads on parity.
