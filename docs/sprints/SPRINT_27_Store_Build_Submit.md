#!/usr/bin/env markdown
# Sprint 27 — Store Build + Submit (2h)

- Goal: Produce an iOS production build and submit to App Store Connect (ASC).
- Acceptance: Build uploaded; selected on the 1.0.1 version in ASC; submission queued for review.
- Dependencies: 24 (Metadata), 25 (Compliance), 26 (Final QA)
- Status: Completed — build/submit initiated; awaiting App Review

## Operator Steps
1) Prepare credentials
   - Apple Developer access for the team
   - Preferred: App Store Connect API Key (Issuer ID, Key ID, .p8 key)
   - Alternative: Apple ID + app‑specific password (less recommended)

2) Authenticate EAS locally (or CI)
   - `expo login` (or set `EXPO_TOKEN` in CI)

3) Build the production binary
   - `cd mobile`
   - Verify API base in `eas.json` → `production.env.EXPO_PUBLIC_API_URL`
   - `npm run build:ios:prod`
   - Notes: EAS will manage signing on first run; accept prompts to create or reuse certificates/profiles.

4) Submit the build
   - After build completes: `npm run submit:ios:latest`
   - Provide ASC API key or Apple ID credentials when prompted (or configure EAS secrets ahead of time).

5) Finalize in App Store Connect (Version 1.0.1)
   - Select the uploaded build on the version page
   - Paste What’s New; confirm screenshots and privacy answers
   - Submit for review

## References
- Metadata: `docs/release/APP_STORE_METADATA.md`
- Compliance: `docs/release/COMPLIANCE_CHECKLIST.md`, `docs/release/EXPORT_COMPLIANCE.md`
- Runbook: `docs/STAGING_RUNBOOK.md`
