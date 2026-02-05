## Staging QA Checklist (Sprint 26)

Environment
- [ ] Server health: `GET /health` returns `{ ok: true, version, uptime }`
- [ ] Mobile app points to staging API (`EXPO_PUBLIC_API_URL`)
- [ ] Demo account credentials available

Smoke
- [ ] Launch app (Expo/TestFlight); About screen shows API base and health
- [ ] Login with demo account; user lands on Route List
- [ ] Pull-to-refresh updates the list without error

Core Flows
- [ ] Open a visit → checklist shows expected items
- [ ] Check In → time displays; no errors if location denied
- [ ] Toggle 1–2 checklist items → state persists while on screen
- [ ] Submit (Check Out) → ✓ success banner appears
- [ ] Return to Route List → item shows Completed status

Offline & Retry
- [ ] With a visit open, enable Airplane Mode
- [ ] Submit → “Saved offline — will sync when online” banner
- [ ] Disable Airplane Mode → app auto-retries; success banner appears

Idempotency & Visit State
- [ ] Submit the same visit twice → server responds idempotent; no duplicate effects
- [ ] `GET /api/routes/today` reflects `completedToday` for the visit

Admin Reset (staging only)
- [ ] As admin, call `POST /api/admin/visit-state/reset` → route flags clear
- [ ] Route List shows neutral state after refresh

A11y & Polish
- [ ] Buttons have readable labels; hit targets feel generous
- [ ] Map button press shows micro‑animation; no jank
- [ ] Performance: list scrolls smoothly; navigation is snappy

Notes
- Record any issues with: steps, expected/actual, screenshots/logs, build version, API base.

