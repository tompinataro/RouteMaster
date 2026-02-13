#!/usr/bin/env markdown
# Sprint 4 — Type Safety & Lint (2h)

- Goal: Tighten Typescript and basic lint rules across mobile.
- Tasks:
  - Enable `tsc --noEmit` in CI and fix surfaced issues.
  - Add a minimal ESLint config (or tighten existing rules).
  - Remove any `any` where practical; add types for API responses.
- Acceptance:
  - `npm run typecheck` passes; ESLint minimal rules pass.
- Dependencies: Sprint 1
- Status: DONE
- Notes:
  - Strict TS enabled; `npm run typecheck` added.
  - ESLint config added at `.eslintrc.cjs` with TS + React rules.
  - Scripts: `npm run lint`, `npm run lint:fix`.
