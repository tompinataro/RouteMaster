#!/usr/bin/env markdown
# Sprint 31 — CI/Engines Tidy (2h)

- Goal: Align Node versions across Heroku and CI; keep deploy logs clean.
- Acceptance: Heroku no longer warns about engines; CI uses Node 20.
- Status: Completed

Changes
- Pinned Node engine to 20.x in root `package.json`.
- Updated GitHub Actions CI to use Node 20 for all jobs.

Files
- package.json — `engines.node: 20.x`
- .github/workflows/ci.yml — setup-node uses `node-version: 20`

