# App Privacy Responses (Apple Questionnaire)

This document maps Bloom Steward’s data practices to Apple’s App Privacy categories. Use it to answer the App Store Connect privacy questionnaire.

Summary
- Tracking: None
- Third‑party advertising: None
- Analytics: None (no third‑party SDKs)
- Data collection: Minimal — account email; visit submissions (notes/checklist); approximate location (optional) for check‑in/out; diagnostic logs (transient)
- Data linked to user: Yes — account email and visits are linked to an authenticated user account

Data Types and Usage

1) Contact Info → Email
- Collected: Yes (upon login/account)
- Linked to the user: Yes
- Used for: App Functionality (authentication/account), Customer Support (optional)
- Tracking: No

2) Location → Approximate Location
- Collected: Optional (only when user checks in/out and grants permission)
- Linked to the user: Yes (as part of a visit submission)
- Used for: App Functionality (verifying visit presence)
- Tracking: No

3) User Content → Notes
- Collected: Yes (visit submissions include optional notes/checklist)
- Linked to the user: Yes (stored with the visit/user)
- Used for: App Functionality (fulfilling visits, office review)
- Tracking: No

4) Identifiers
- Device ID/Advertising ID: Not collected
- Account/user ID: Yes (server assigns internal user/visit IDs)
- Linked to the user: Yes (by definition)
- Used for: App Functionality
- Tracking: No

5) Diagnostics
- Crash/Performance: No third‑party analytics; server logs may include errors for reliability
- Linked to the user: No (logs are not used to profile users)
- Used for: App Functionality, Debugging
- Tracking: No

Other Disclosures
- Data sharing with third parties: None beyond hosting providers necessary to operate the service (e.g., app server/DB)
- Data retention: Visit submissions retained per organization policy; users may request corrections via support
- Encryption: All network traffic over HTTPS; tokens stored securely on device

Notes for ASC
- If a user denies location permission, visit flows still work (location omitted).
- The app does not use advertising identifiers (IDFA) or fingerprinting.

