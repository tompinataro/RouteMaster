#!/usr/bin/env markdown
# Sprint 34 — Apple Developer Setup (2h)

- Goal: Create the App ID, decide capabilities, and align App Store/Provisioning choices for Bloom Steward.
- Owner: Tom (Apple Developer Program)
- Acceptance: App ID registered (explicit), decisions captured, ASC app created, ready for EAS-managed signing.
- Status: Pending — waiting on Apple Developer actions

## Decisions (fill in or confirm)
- Team: Thomas Anthony Pinataro — Team ID `S4Y9X74BAL`
- App ID (Bundle ID): `com.pinataro.bloomsteward` (Explicit)
- App Name (ASC): Bloom Steward
- Signing: Use EAS Managed Credentials (Expo handles certs/profiles)
- Capabilities enabled now: None (defaults only)
  - Background Modes are already declared in `mobile/app.json` (Info.plist) and do not require portal toggles.
  - Location permission is declared in Info.plist (already set). No separate capability needed.
- Capabilities to defer (can enable later without resubmitting App ID):
  - Push Notifications (APNs) — not used today
  - Sign in with Apple — not used
  - Associated Domains (Universal Links) — not used
  - In‑App Purchase, iCloud, HealthKit, NFC — not used

## Step‑by‑Step — Certificates, Identifiers & Profiles
1) Register App ID
   - Platform: iOS
   - Description: Use a simple value (e.g., "Bloom Steward mobile app").
     - Note: If you see “Invalid description.” remove punctuation (colon/quotes) and keep it short.
   - Bundle ID: Explicit → `com.pinataro.bloomsteward`
   - Capabilities: leave unchecked for now (no Push/iCloud/etc.)
   - Continue → Register

2) (Optional) If you prefer manual signing (not recommended here)
   - Create iOS Distribution certificate
   - Create App Store provisioning profile for `com.pinataro.bloomsteward`
   - Otherwise skip — EAS Managed Credentials will create these on first build

## Step‑by‑Step — App Store Connect (ASC)
1) My Apps → New App
   - Platform: iOS
   - Name: Bloom Steward
   - Primary language: English (US)
   - Bundle ID: `com.pinataro.bloomsteward`
   - SKU: `bloom-steward-ios-1`
   - User Access: Full Access
2) Fill metadata & privacy (use repo docs):
   - `docs/release/APP_STORE_METADATA.md`
   - `docs/release/COMPLIANCE_CHECKLIST.md`
   - `docs/release/APP_PRIVACY.md`

## Ticklist (Apple Portal)
- [ ] Apple Developer → Identifiers → Register App ID
  - [ ] Platform: iOS
  - [ ] Description: see snippet below (no punctuation)
  - [ ] Bundle ID (Explicit): `com.pinataro.bloomsteward`
  - [ ] Capabilities: none for now
- [ ] (If manual signing) Create iOS Distribution cert + App Store profile
- [ ] App Store Connect → My Apps → New App
  - [ ] Platform: iOS, Name: Bloom Steward, Language: English (US)
  - [ ] Bundle ID: `com.pinataro.bloomsteward`, SKU: `bloom-steward-ios-1`, Access: Full
  - [ ] Fill metadata & privacy using repo docs
- [ ] First EAS iOS build (managed credentials): run interactively to create cert/profile
- [ ] Confirm ASC build appears on 1.0.1 version page

## Copy/Paste Snippets
- App ID Description (Apple Developer):
  - Bloom Steward mobile app
- ASC SKU suggestion:
  - bloom-steward-ios-1

## What I (repo) already prepared
- Background fetch + location usage strings in `mobile/app.json` Info.plist
- EAS profiles (`preview`, `staging`, `production`) and build scripts
- Privacy/Support pages (publish via GitHub Pages)

## Done When
- App ID exists and matches `com.pinataro.bloomsteward`
- ASC app created and linked to that Bundle ID
- Decision doc updated (below) and this sprint marked complete
