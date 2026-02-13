# Apple Developer Decisions — Bloom Steward

Team
- Name: Thomas Anthony Pinataro
- Team ID: `S4Y9X74BAL`

App ID
- Type: Explicit
- Bundle ID: `com.pinataro.bloomsteward`
- Description suggestion: "Bloom Steward mobile app" (avoid punctuation/special characters to prevent "Invalid description" errors)

Capabilities (Enable Now vs Later)
- Enable Now (recommended today):
  - None (defaults only). Background fetch and location permission are handled via Info.plist keys already present in `mobile/app.json`.
- Defer (can enable later if/when needed):
  - Push Notifications (APNs)
  - Sign in with Apple
  - Associated Domains (universal links)
  - In‑App Purchase, iCloud, HealthKit, NFC, Maps, etc.

Signing/Provisioning
- Preferred: EAS Managed Credentials (Expo will create iOS Distribution cert and App Store profile on first build)
- Manual (not recommended here): create cert + provisioning profile matching the App ID

App Store Connect
- New App → iOS → Name: Bloom Steward → Bundle ID: `com.pinataro.bloomsteward` → SKU: `bloom-steward-ios-1`
- Use repo metadata for fields, privacy, and compliance:
  - `docs/release/APP_STORE_METADATA.md`
  - `docs/release/COMPLIANCE_CHECKLIST.md`
  - `docs/release/APP_PRIVACY.md`

Notes
- Background Modes: Already set `UIBackgroundModes: ["fetch"]` in app.json; no separate portal capability toggle required.
- Location: `NSLocationWhenInUseUsageDescription` set; user may deny and app remains functional.
- You can add Push/Associated Domains later without changing the Bundle ID.

