## Production API Domain — Runbook (Sprint 30)

Goal
- Move from the Heroku app URL to a custom production API domain (e.g., `api.bloomsteward.com`).

Options
- Host stays on Heroku; add a custom domain + SSL (ACM)
- Or migrate to another host (Render/Fly/etc.) then set DNS to that host

Steps (Heroku)
1) Choose domain (e.g., `api.yourdomain.com`)
2) In Heroku → App → Settings → Domains, add the domain
3) Copy the target hostname (e.g., `your-app.herokudns.com`)
4) In your DNS provider, create a CNAME:
   - Name: `api`
   - Target: the `*.herokudns.com` value
5) Enable SSL (Heroku ACM auto‑provisions; wait for green lock)
6) Verify: `curl https://api.yourdomain.com/health`

Mobile Configuration
- Temporary/local dev (.env):
  - `cd mobile && cp .env.production.example .env`
  - Edit `.env` → `EXPO_PUBLIC_API_URL=https://api.yourdomain.com`
  - Start: `npx expo start -c`
- EAS Production Profile (permanent):
  - Edit `mobile/eas.json` → set `build.production.env.EXPO_PUBLIC_API_URL` to your domain
  - Build: `npm run build:ios:prod`

Helper Script (already added)
- In `mobile/` you can run:
```
EXPO_PUBLIC_API_URL=https://api.yourdomain.com npm run env:prod:custom
```
- This writes `.env` with the given URL for local testing.

Smoke Test (after DNS cutover)
- `curl https://api.yourdomain.com/health` → `{ ok: true, version, uptime }`
- In app (staging/prod build): login → fetch route list → open visit → submit

Notes
- Current profiles point to Heroku URL; update production only when the new domain is live.
- CORS: Server uses permissive CORS; if you later restrict origins, include your web origin(s).

