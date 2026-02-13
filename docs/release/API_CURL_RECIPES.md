# API Curl Recipes (Staging QA)

Base
```
export API="https://bloom-steward-2a872c497756.herokuapp.com"
```

Login → Bearer token
```
TOKEN=$(curl -s -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"password"}' | jq -r .token)
echo $TOKEN
```

Routes Today
```
curl -s "$API/api/routes/today" -H "Authorization: Bearer $TOKEN" | jq
```

Visit Details
```
ID=101
curl -s "$API/api/visits/$ID" -H "Authorization: Bearer $TOKEN" | jq
```

Mark In‑Progress
```
curl -s -X POST "$API/api/visits/$ID/in-progress" -H "Authorization: Bearer $TOKEN" | jq
```

Submit (idempotent on repeat)
```
curl -s -X POST "$API/api/visits/$ID/submit" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"notes":"qa","checklist":[],"checkOutTs":"2025-01-01T00:00:00Z"}' | jq
```

Admin Reset (staging only; requires admin token/email)
```
curl -s -X POST "$API/api/admin/visit-state/reset" -H "Authorization: Bearer $TOKEN" | jq
```

