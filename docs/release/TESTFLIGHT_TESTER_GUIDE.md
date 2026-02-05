# TestFlight Tester Guide — Bloom Steward

Welcome! This guide helps you install the TestFlight build, sign in, and try the core flows.

Get Access
- You will receive an email invite from Apple TestFlight (or a public link)
- Open on your iPhone and follow the prompts to install TestFlight

Install the App
1) Install TestFlight from the App Store
2) In the TestFlight app, accept the Bloom Steward invite
3) Tap Install to download the latest build

Sign In
- Use your organization account, or the demo account if provided by the team
- Demo (for Apple review/testing): `demo@example.com` / `password`

What To Try (5–10 minutes)
1) Open the app and log in
2) Route List: Pull to refresh; open a visit
3) Visit Details: Toggle 1–2 checklist items
4) Check In: Tap the Check In button (allow or deny location — both are supported)
5) Submit: Tap “Check Out & Complete Visit” → look for a ✓ success banner

Offline Scenario (optional)
- With a visit open, enable Airplane Mode
- Submit: You should see “Saved offline — will sync when online”
- Turn off Airplane Mode: The app should retry automatically and succeed

Resetting Test Data (staging only)
- The team can reset the daily server state if needed
- Endpoint: `POST /api/admin/visit-state/reset` — see `docs/STAGING_RUNBOOK.md`

Send Feedback
- From TestFlight’s app page, tap “Send Beta Feedback”
- Include: steps, expected vs. actual, screenshots (if possible)
- Helpful details: device model, iOS version, app build (visible in TestFlight)

Troubleshooting
- Can’t log in: Confirm account email/password with your contact
- Network errors: Try again on Wi‑Fi; pull to refresh on the Route List
- Location prompt: If denied, flows still work; you can enable later in Settings

Privacy
- The app uses HTTPS only and collects minimal data to perform visit submissions
- Location is optional; no advertising or tracking SDKs

Support
- Contact: see `docs/support.md`

