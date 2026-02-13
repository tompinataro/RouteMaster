# Bloom Steward Go-Live Checklist

## Operational Rules
- Visit state persistence: define how long a completed/in-progress visit should persist (daily, weekly, biweekly, monthly).
- Cadence by role: confirm if persistence rules can vary by service route (SR) and field technician (FT).
- Reset policy: specify who can clear today's visit state and under what conditions (admin-only vs. tech-initiated).

## Current Behavior (As Built)
- Prompt: "meanwhile, how long it it set to persist now? maybe it's set to stay persistent until the reset is hit?"
- Answer: Right now the checkmarks persist per day, not per week/month. The server stores visit state in visit_state keyed by YYYY‑MM‑DD + user + visit, so if you sign back in the same day you’ll see the same completed/in‑progress flags. They clear automatically when the date changes (server time) or when an admin resets that day’s state.
- Important detail: the Reset button you see is currently only clearing the local cache. Because the server still has visit_state rows for today, the checkmarks come back after reload. That’s why you’re seeing “already checked” items on Jacob.
- Option: If you want that Reset button to truly clear today’s server state (for QA), wire it to the admin reset endpoint or add a tech‑only “reset my day” endpoint.

## Product Positioning (Internal)
- As the app is set now, Jacob could pick and choose which CLs on his SR he goes to and when he goes to them during the course of the day.
- In other words, the FT can create his/her own "Today's Route for <FT>" from their complete list of CLs that are assigned to their total "Route."
- They customize their route and the database keeps track of their work so they can get compensated for their work.
- From an internal marketing perspective: This app will pay for itself.
