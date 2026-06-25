# API Rate-Limiting & Gateway SaaS — Project Report

**Project Path:** `d:\Project\gatewayservice`
**Stack:** Node.js · Express · MySQL · Redis · JWT · Artillery
**Status:** ✅ Running on `http://localhost:3000`

---

## 1. What We Built

A production-grade **API Gateway SaaS** — a service that sits in front of other APIs and acts as a smart traffic controller. Developers sign up, get an API key, and route all their app's requests through our gateway. We enforce rate limits per tier, proxy the request to the real upstream API, and log every event asynchronously for analytics.

This mirrors how commercial products like **Kong, Apigee, and AWS API Gateway** work at their core.

---

## 2. Full Project Structure

```
d:\Project\gatewayservice\
├── config/
│   ├── db.js               MySQL connection pool (mysql2/promise)
│   ├── redis.js            ioredis singleton client
│   └── schema.sql          DDL for all 3 database tables
├── controllers/
│   ├── authController.js   Register + Login logic
│   ├── keyController.js    Generate / List / Revoke API keys
│   ├── gatewayController.js  Proxy requests + fire-and-forget logging
│   └── analyticsController.js  SQL aggregation for dashboard data
├── middleware/
│   ├── authenticate.js     JWT verification middleware
│   └── rateLimiter.js      ⚡ The Core Engine — Redis Token Bucket
├── routes/
│   ├── authRoutes.js       POST /auth/register, /auth/login
│   ├── keyRoutes.js        POST|GET|DELETE /api/keys/*
│   ├── gatewayRoutes.js    ALL /v1/* (catch-all proxy)
│   └── analyticsRoutes.js  GET /api/analytics/*
├── utils/
│   └── logger.js           Async MySQL request logger
├── .env                    Environment secrets (DB, Redis, JWT)
├── .env.example            Safe template for version control
├── .gitignore              Protects secrets from Git
├── artillery.yml           Load test configuration
├── package.json            Dependencies manifest
└── server.js               Express entry point + graceful shutdown
```

**Total: 18 files created from scratch.**

---

## 3. Database Architecture (Phase 1)

Three MySQL tables were designed in [`config/schema.sql`](file:///d:/Project/gatewayservice/config/schema.sql):

### `users`
Stores developer accounts.

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` | UUID primary key |
| `email` | `VARCHAR(255)` | Unique — prevents duplicate accounts |
| `password_hash` | `VARCHAR(255)` | bcrypt hash (cost factor 12) |
| `subscription_tier` | `ENUM` | `FREE` / `PRO` / `ENTERPRISE` |
| `created_at` | `TIMESTAMP` | Auto-set on insert |

### `api_keys`
Stores the gateway API keys issued to developers.

| Column | Type | Notes |
|---|---|---|
| `key_id` | `VARCHAR(80)` | e.g. `gw_live_<64 hex chars>` |
| `user_id` | `CHAR(36)` | FK → `users.id` (CASCADE DELETE) |
| `status` | `ENUM` | `ACTIVE` / `REVOKED` (soft delete) |
| `created_at` | `TIMESTAMP` | |

### `request_logs`
Append-only analytics table — every gateway request is logged here.

| Column | Type | Notes |
|---|---|---|
| `log_id` | `BIGINT UNSIGNED` | Auto-increment PK |
| `key_id` | `VARCHAR(80)` | Soft FK — logs survive key revocation |
| `endpoint_accessed` | `VARCHAR(500)` | Full path e.g. `/v1/posts/1` |
| `status_code` | `SMALLINT` | 200, 429, 502, etc. |
| `response_time_ms` | `INT` | Gateway round-trip latency |
| `timestamp` | `TIMESTAMP` | Indexed for fast date-range queries |

> **Schema was imported** using PowerShell's pipe syntax (the `<` redirect operator is unsupported in PowerShell):
> ```powershell
> Get-Content config/schema.sql | mysql -u root -p
> ```

---

## 4. Authentication System (Phase 2)

### User Registration & Login
**File:** [`controllers/authController.js`](file:///d:/Project/gatewayservice/controllers/authController.js)

- `POST /auth/register` — Hashes the password with **bcrypt** (cost=12), stores the user, returns a signed JWT.
- `POST /auth/login` — Verifies the password, returns a fresh JWT with `{ userId, email, tier }` embedded in the payload.
- Security detail: Both login failure cases (wrong email / wrong password) return the same generic `"Invalid email or password."` message — preventing **email enumeration attacks**.

### API Key Management
**File:** [`controllers/keyController.js`](file:///d:/Project/gatewayservice/controllers/keyController.js)

- `POST /api/keys/generate` — Uses Node's **`crypto.randomBytes(32)`** to generate 256 bits of cryptographic entropy, formatted as `gw_live_<64 hex chars>`. The key is shown **only once** at generation time.
- `GET /api/keys` — Lists all ACTIVE keys, returning a **masked** version (`gw_live_xxxxxxxxxxxxxxxx...`) for security.
- `DELETE /api/keys/:keyId` — **Soft deletes** (sets `status = REVOKED`) rather than hard deleting, so historical analytics data in `request_logs` remains intact.

### JWT Middleware
**File:** [`middleware/authenticate.js`](file:///d:/Project/gatewayservice/middleware/authenticate.js)

Verifies the `Authorization: Bearer <token>` header. Differentiates between `TokenExpiredError` (tells user to log in again) vs a generic invalid token — better developer experience.

---

## 5. The Core Engine — Redis Token Bucket (Phase 3)

**File:** [`middleware/rateLimiter.js`](file:///d:/Project/gatewayservice/middleware/rateLimiter.js)

This is the most important and technically impressive part of the project.

### Rate Limits by Tier

| Tier | Requests per 60 seconds |
|---|---|
| `FREE` | 100 |
| `PRO` | 10,000 |
| `ENTERPRISE` | 100,000 |

### How It Works (on every `/v1/*` request)

```
1. Extract x-api-key header → 401 if missing
2. Check Redis cache ("gw:meta:<key>") for tier + userId
   └─ Cache HIT  → skip DB entirely (sub-millisecond)
   └─ Cache MISS → query MySQL, write result back to Redis (TTL: 5 min)
3. Run atomic Lua script in Redis:
   └─ GET counter for this key
   └─ If count >= limit → return 429 + Retry-After header
   └─ If count < limit  → INCR counter (SET with EX on first request)
4. Attach req.apiKey, req.tier, req.keyOwner for downstream use
5. Set X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Window headers
```

### Why a Lua Script?

A naive implementation does `GET` then `INCR` as two separate Redis commands. Under concurrent load, two requests can both read `count=99` (below limit), both pass, and both increment to 100 and 101 — exceeding the limit. This is a classic **TOCTOU race condition**.

The Lua script runs atomically — Redis executes it as a single uninterruptible operation. No race condition is possible.

### The 5-Minute Metadata Cache

Without the cache, every single API request would require a MySQL query to look up the key's tier. At 5,000 req/s, that's 5,000 DB queries per second — unsustainable.

With the cache: the first request per key does one MySQL lookup, writes `"FREE:uuid"` to Redis with a 5-minute TTL, and every subsequent request for the next 5 minutes hits only Redis — which responds in under 1ms.

### Response Headers (like GitHub's API)
Every response carries:
```
X-RateLimit-Limit:     100
X-RateLimit-Remaining: 73
X-RateLimit-Window:    60s
Retry-After:           42    ← only on 429 responses
```

---

## 6. Request Proxying & Async Logging (Phase 4)

**Files:** [`controllers/gatewayController.js`](file:///d:/Project/gatewayservice/controllers/gatewayController.js) · [`utils/logger.js`](file:///d:/Project/gatewayservice/utils/logger.js)

### Proxy Logic
- Uses **`axios`** to forward the full request (method, headers, body, query params) to `PROXY_TARGET` (`https://jsonplaceholder.typicode.com`)
- Strips `x-api-key` and `host` headers before forwarding (security + correctness)
- Measures latency with **`process.hrtime.bigint()`** — nanosecond precision
- Forwards only safe upstream headers (`content-type`, `cache-control`, `etag`)
- Returns a clean `502 Bad Gateway` if upstream is unreachable

### Fire-and-Forget Logging (Critical Design Rule)
```js
// Response is sent to client FIRST
res.json(upstreamResponse.data);

// THEN we log — no await, client latency is unaffected
logRequest({ keyId, endpoint, statusCode, responseTimeMs });
```

The `logRequest()` call has **no `await`**. The MySQL insert happens after the client has already received their response. This keeps gateway-added latency near zero regardless of MySQL write speed.

Both successful (200) and rate-limited (429) requests are logged.

---

## 7. Analytics Dashboard API (Phase 5)

**File:** [`controllers/analyticsController.js`](file:///d:/Project/gatewayservice/controllers/analyticsController.js)

### `GET /api/analytics/usage`
Returns per-day aggregated stats for the last 7 days:

```sql
SELECT
  DATE(rl.timestamp)                                      AS date,
  COUNT(*)                                                AS total_requests,
  SUM(CASE WHEN rl.status_code = 429 THEN 1 ELSE 0 END)  AS blocked_requests,
  SUM(CASE WHEN rl.status_code != 429 THEN 1 ELSE 0 END) AS successful_requests,
  ROUND(AVG(rl.response_time_ms), 2)                     AS avg_response_time_ms
FROM request_logs rl
JOIN api_keys ak ON rl.key_id = ak.key_id
WHERE ak.user_id = ? AND rl.timestamp >= NOW() - INTERVAL 7 DAY
GROUP BY DATE(rl.timestamp)
ORDER BY date DESC
```

Response example:
```json
{
  "period": "last_7_days",
  "tier": "FREE",
  "rate_limit_per_minute": 100,
  "data": [
    {
      "date": "2024-07-01",
      "total_requests": 542,
      "successful_requests": 500,
      "blocked_requests": 42,
      "avg_response_time_ms": 18.3
    }
  ]
}
```

### `GET /api/analytics/keys-summary`
Returns per-key traffic breakdown — useful when a developer has multiple keys across different integrations.

---

## 8. Infrastructure Setup

### Redis Installation
Redis is not natively available on Windows. We installed it using **winget**:
```powershell
winget install Redis.Redis --accept-package-agreements
```
- Version: **3.0.504** (Windows port)
- Default port: **6379**
- Installation path: `C:\Program Files\Redis\`
- Started as a background process: `redis-server.exe redis.windows.conf`
- Verified with: `redis-cli ping` → `PONG`

### MySQL
- Already installed locally
- Database created: `gateway_saas`
- Schema imported via: `Get-Content config/schema.sql | mysql -u root -p`
- Connection verified via pool startup log

### Issues Resolved During Setup

| Issue | Cause | Fix |
|---|---|---|
| `mysql < schema.sql` failed | PowerShell doesn't support `<` redirection | Used `Get-Content \| mysql` instead |
| `Access denied` for MySQL | `@` in password not parsed correctly by dotenv | Wrapped value in quotes: `DB_PASS="Rushu@424"` |
| `EADDRINUSE :3000` | Old Node process still holding the port | `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force` |
| Browser `GET / 404` | No root route existed | Added JSON API-info root endpoint to `server.js` |
| `favicon.ico 404` | No browser icon — harmless for an API | Explained as expected/ignorable |

---

## 9. Security & Production Practices

| Practice | Implementation |
|---|---|
| Password hashing | bcrypt, cost factor 12 |
| Key generation | `crypto.randomBytes(32)` — 256-bit entropy |
| Secret management | All secrets in `.env`, gitignored |
| Key revocation | Soft delete — analytics data preserved |
| Email enumeration prevention | Generic error message for wrong email/password |
| Atomic rate limiting | Redis Lua script — no race conditions |
| Graceful shutdown | Closes MySQL pool + Redis on SIGINT/SIGTERM |
| Async logging | Fire-and-forget — DB writes never block responses |
| `.gitignore` | Covers `.env`, `node_modules`, logs, OS/editor files |

---

## 10. Benchmarking Setup (Phase 6)

**File:** [`artillery.yml`](file:///d:/Project/gatewayservice/artillery.yml)

Three-phase load test:

| Phase | Duration | Rate |
|---|---|---|
| Warm-up | 15s | 5 → 50 req/s (ramp) |
| Sustained | 30s | 200 req/s |
| Spike | 15s | 500 req/s |

**Automated assertion:** Fails the benchmark if p95 latency > 100ms.

To run:
```powershell
# First, paste your gw_live_xxx key into artillery.yml
npx artillery run artillery.yml
```

Expected behaviour: FREE-tier key (100 req/60s) will start returning 429s during the sustained phase — proving the rate limiter works correctly under load.

---

## 11. API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/` | None | API info page |
| `GET` | `/health` | None | Health check |
| `POST` | `/auth/register` | None | Create account |
| `POST` | `/auth/login` | None | Get JWT token |
| `POST` | `/api/keys/generate` | JWT | Generate API key |
| `GET` | `/api/keys` | JWT | List active keys |
| `DELETE` | `/api/keys/:keyId` | JWT | Revoke a key |
| `GET` | `/api/analytics/usage` | JWT | 7-day daily stats |
| `GET` | `/api/analytics/keys-summary` | JWT | Per-key traffic |
| `ALL` | `/v1/*` | `x-api-key` | Proxied gateway traffic |

---

## 12. Quick Test Commands

```powershell
# 1. Register
$reg = Invoke-RestMethod -Uri http://localhost:3000/auth/register `
  -Method POST -ContentType "application/json" `
  -Body '{"email":"dev@example.com","password":"password123"}'
$token = $reg.token

# 2. Generate API Key
$keyResp = Invoke-RestMethod -Uri http://localhost:3000/api/keys/generate `
  -Method POST -Headers @{Authorization="Bearer $token"}
$apiKey = $keyResp.key.key_id

# 3. Hit the Gateway
Invoke-RestMethod -Uri http://localhost:3000/v1/posts/1 `
  -Headers @{"x-api-key"=$apiKey}

# 4. Analytics
Invoke-RestMethod -Uri http://localhost:3000/api/analytics/usage `
  -Headers @{Authorization="Bearer $token"}
```

---

## 13. Next Steps

- [ ] **Run Artillery benchmark** — paste your key into `artillery.yml`, run `npx artillery run artillery.yml`
- [ ] **Upgrade Redis** — `winget install taizod1024.redis-windows-fork` for Redis 8.x (vs the current 3.x Windows port)
- [ ] **Add a frontend dashboard** — plug the analytics API into a charting library (Chart.js / Recharts)
- [ ] **Add subscription tiers** — build a `PATCH /api/user/tier` endpoint to upgrade FREE → PRO
- [ ] **Add HTTPS** — use `nginx` or Cloudflare as a TLS termination layer in front of Express
- [ ] **Deploy** — Railway, Render, or a VPS with PM2 for process management
