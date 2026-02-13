# RouteMaster

RouteMaster is the generic parent pattern for the Bloom Steward app. It keeps the same core architecture, but uses generic branding and placeholder copy/assets.

# Developer Guide

## Features
- Technician check-ins and task tracking
- Quality control reporting
- Work Summary Report with per-visit mileage legs, per-tech mileage totals, visit date, notes, contact, and geo validation
- Data persistence with PostgreSQL
- Secure user authentication
- Responsive React front-end

## Tech Stack
- React, Redux, Axios
- Node.js, Express
- PostgreSQL
- Heroku deployment

## Getting Started
1. Clone the repository
2. Install dependencies with `npm install` (root) and `npm install` in `mobile/`
3. Create environment files
   - Server: values from your local setup (optional for MVP)
   - Mobile: `mobile/.env` with `EXPO_PUBLIC_API_URL=http://localhost:5100`
4. Build the server with `npm run build` (Heroku runs this automatically)
5. Run the API locally with `npm run dev` (TypeScript) or `npm run server` (compiled)
6. Run the mobile app from `mobile/` with `npm start`

### Endpoints
- `GET /health` – liveness check (returns version + uptime)
- `GET /metrics` – Prometheus metrics (counters + duration histogram)
- `POST /api/auth/login` – returns a demo token and user
- `POST /api/auth/refresh` – returns a fresh token for a valid session
- `GET /api/routes/today` – requires `Authorization: Bearer <token>`
- `GET /api/visits/:id` – requires auth
- `POST /api/visits/:id/submit` – requires auth

### Database (optional for MVP)
- The API uses Postgres when `DATABASE_URL` is set; otherwise it serves demo data in-memory.
- To provision locally, create a DB and run:
  - `psql "$DATABASE_URL" -f server/sql/schema.sql`
  - `psql "$DATABASE_URL" -f server/sql/seed.sql`
- Demo credentials (override via env):
  - `DEMO_EMAIL=demo@example.com`
  - `DEMO_PASSWORD=password`

#### Visit State (Sprint 5/8) configuration
- `VISIT_STATE_READ_MODE` — `db` | `memory` | `shadow`
  - `db`: read visit flags from `visit_state` table.
  - `memory`: read visit flags from in-memory map (Phase A).
  - `shadow`: read from DB but log a one-time comparison against in-memory for the day.
- Staging default: when `STAGING=1` (or `NODE_ENV` includes `staging`), the server defaults to `shadow` if DB is present.

### Linting & Type Checking
- Type check: `npm run typecheck`
- Lint: `npm run lint` (fix with `npm run lint:fix`)

### Simulator Quick Start (recommended)
1. Terminal A: `npm run dev`
2. Terminal B:
   - `printf "EXPO_PUBLIC_API_URL=http://localhost:5100\n" > mobile/.env`
   - `cd mobile && npx expo start -c --ios`

## Deployment
- Configure your own deployment target and `EXPO_PUBLIC_API_URL`.

### Mobile Build Quick Start
```bash
cd mobile
npm install
npm run build:android:prod
npm run build:ios:prod
```
See the detailed guides in `docs/release/ANDROID_BETA.md` and `docs/release/STORE_BUILD_SUBMIT.md` for submission steps (replace identifiers/credentials first).

## License
This project was developed as part of Prime Digital Academy and is maintained by Tom Pinataro.
