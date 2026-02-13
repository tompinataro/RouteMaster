## Release Checklist (Sprints 24–33)

Metadata & Compliance
- [ ] Fill metadata in ASC (use docs/release/APP_STORE_METADATA.md)
- [ ] Complete App Privacy + Export Compliance (docs/release/COMPLIANCE_CHECKLIST.md)
- [ ] Publish/verify Privacy + Support pages via GitHub Pages (`docs/privacy/index.html`, `docs/support/index.html`)

QA & Screenshots
- [ ] Run staging QA (docs/release/STAGING_QA_CHECKLIST.md)
- [ ] Capture 6.7” and 6.1” screenshots (docs/release/SCREENSHOT_SHOTLIST.md)

Build & Submit — iOS
- [ ] Build iOS production (mobile: `npm run build:ios:prod`)
- [ ] Submit latest to ASC (mobile: `npm run submit:ios:latest`)
- [ ] Select build on version 1.0.1; paste “What’s New”

Build & Internal — Android (optional)
- [ ] First-time keystore (interactive): `eas build -p android --profile preview`
- [ ] Subsequent CI/internal builds (mobile: `npm run build:android:internal`)

Tag & Docs
- [ ] Tag v1.0.1 (docs/release/TAGGING.md)
- [ ] Tester onboarding ready (docs/release/TESTFLIGHT_TESTER_GUIDE.md)

Production Domain (optional)
- [ ] Configure custom API domain and update production env (docs/release/PRODUCTION_API_DOMAIN.md)
