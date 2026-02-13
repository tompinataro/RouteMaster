# Admin Endpoints Reference

## Run Seed SQL

**Endpoint:** `POST /api/admin/run-seed`

**Authentication:** Requires admin token (use admin account credentials)

**Description:** Executes the `server/sql/seed.sql` file within a database transaction. This idempotently resets all seed data including:
- Deletes and recreates all clients
- Deletes and recreates all visits (one per client)
- Deletes and recreates visit checklists
- Deletes and recreates routes_today assignments
- Deletes and recreates visit submissions
- Repopulates daily_start_odometer readings

**Example:**

```bash
# Set the API base URL for your environment
API_BASE_URL="http://localhost:5100"

# Get admin token
TOKEN=$(curl -s -X POST "$API_BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Run seed
curl -X POST "$API_BASE_URL/api/admin/run-seed" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Response:**
```json
{
  "ok": true,
  "appliedStatements": 24
}
```

## Recent Fixes (v92-v93)

### Mobile UI Fixes
1. **VisitDetailScreen scrolling** - Increased bottom padding to allow odometer input to scroll above sticky submit button
2. **RouteListScreen name truncation** - Limited client names to 14 characters to prevent overflow into Map button

### Database Deduplication
1. **Duplicate visits** - Fixed root cause: seed now deletes existing clients/visits before re-inserting
2. **Idempotent seed** - Added explicit DELETE statements for all dependent tables before INSERT
3. **Admin reset endpoint** - New `/api/admin/run-seed` allows one-click DB reset without manual SQL

## Testing Data

Current seed configuration (as of v93):
- **6 clients per tech** (36 total across 6 routes)
- **1 visit per client** (no duplicates)
- **Durations:** 12-20 minutes per visit
- **Mileage:** 3-6 miles per visit (10-25 total per tech per day)
- **Geo validation:** 35% grey circles (no geo), 65% with location data (green/red)

### Tech Accounts
- jacob@b.com / Jacob123 → North route (6 clients)
- sadie@b.com / 50293847 → South route (6 clients)
- chris@b.com / 71920485 → East route (6 clients)
- cameron@b.com / 12837465 → West route (6 clients)
- derek@b.com / 90456123 → Central route (6 clients)

### Admin Account
- admin@example.com / password → Can access /api/admin/* endpoints
