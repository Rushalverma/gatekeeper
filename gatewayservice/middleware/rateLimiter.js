'use strict';

const redis = require('../config/redis');
const pool  = require('../config/db');
const { logRequest } = require('../utils/logger');

// ─── Tier rate limits (requests per WINDOW_SECONDS) ───────────────────────────
const RATE_LIMITS = {
  FREE:       100,
  PRO:        10000,
  ENTERPRISE: 100000,
};

const WINDOW_SECONDS = 60;

// ─── Lua Script for Atomic Token Bucket Check-and-Increment ──────────────────
//
// Why Lua? Redis executes Lua scripts atomically — no race condition between
// GET and INCR is possible. This is critical under concurrent load.
//
// KEYS[1] = the Redis counter key  (e.g., "gw:rl:gw_live_abc123")
// ARGV[1] = the max allowed count  (e.g., "100")
// ARGV[2] = window TTL in seconds  (e.g., "60")
//
// Returns: { current_count, is_new_key } — or -1 if limit exceeded.
const RATE_LIMIT_SCRIPT = `
  local key     = KEYS[1]
  local limit   = tonumber(ARGV[1])
  local ttl     = tonumber(ARGV[2])

  local current = redis.call('GET', key)

  if current == false then
    -- First request in this window: initialize the counter
    redis.call('SET', key, 1, 'EX', ttl)
    return {1, 1}       -- {count, is_new}
  end

  current = tonumber(current)

  if current >= limit then
    -- Bucket exhausted — return -1 as a sentinel
    return {-1, 0}
  end

  -- Increment and return updated count (TTL already set; do not reset it)
  local new_val = redis.call('INCR', key)
  return {new_val, 0}
`;

// ─── Key Metadata Cache (avoids DB hit on every single request) ───────────────
//
// Cache structure in Redis:
//   "gw:meta:<apiKey>" → "<tier>:<userId>"   TTL: 5 minutes
//
// On cache miss: query MySQL, write back to Redis.
// On key revocation: the old cache entry will expire within 5 minutes.
// This is an acceptable trade-off for performance.

async function getKeyMetadata(apiKey) {
  const cacheKey = `gw:meta:${apiKey}`;

  // Try the cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    const [tier, userId] = cached.split(':');
    return { tier, userId, fromCache: true };
  }

  // Cache miss → hit MySQL
  const [rows] = await pool.execute(
    `SELECT ak.user_id, u.subscription_tier
     FROM api_keys ak
     JOIN users u ON ak.user_id = u.id
     WHERE ak.key_id = ? AND ak.status = 'ACTIVE'`,
    [apiKey]
  );

  if (rows.length === 0) return null; // key doesn't exist or is revoked

  const { user_id: userId, subscription_tier: tier } = rows[0];

  // Write to cache — 5 minute TTL
  await redis.set(cacheKey, `${tier}:${userId}`, 'EX', 300);

  return { tier, userId, fromCache: false };
}

// ─── Rate Limiter Middleware ──────────────────────────────────────────────────

async function rateLimiter(req, res, next) {
  // 1. Extract API key from request header
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error:   'Missing API key.',
      message: 'Include your API key in the X-API-Key header.',
    });
  }

  try {
    // 2. Validate the key and fetch the owner's tier
    const meta = await getKeyMetadata(apiKey);

    if (!meta) {
      return res.status(401).json({
        error: 'Invalid or revoked API key.',
      });
    }

    const { tier, userId } = meta;
    const limit = RATE_LIMITS[tier] || RATE_LIMITS.FREE;

    // 3. Run atomic Token Bucket check in Redis
    const redisKey = `gw:rl:${apiKey}`;
    const [count]  = await redis.eval(
      RATE_LIMIT_SCRIPT,
      1,          // number of KEYS
      redisKey,   // KEYS[1]
      limit,      // ARGV[1]
      WINDOW_SECONDS // ARGV[2]
    );

    // 4. Attach metadata for the gateway controller and logger
    req.apiKey     = apiKey;
    req.tier       = tier;
    req.keyOwner   = userId;
    req.rateLimit  = { limit, current: count, windowSeconds: WINDOW_SECONDS };

    // Expose rate limit status in response headers (like GitHub's API does)
    res.set('X-RateLimit-Limit',     String(limit));
    res.set('X-RateLimit-Remaining', String(count === -1 ? 0 : limit - count));
    res.set('X-RateLimit-Window',    `${WINDOW_SECONDS}s`);

    if (count === -1) {
      // Bucket exhausted
      const ttl = await redis.ttl(redisKey);
      res.set('Retry-After', String(ttl > 0 ? ttl : WINDOW_SECONDS));

      // Log the rate limit event asynchronously
      logRequest({
        keyId:          apiKey,
        endpoint:       req.originalUrl,
        statusCode:     429,
        responseTimeMs: 0,
      });

      return res.status(429).json({
        error:       'Rate limit exceeded.',
        message:     `Your ${tier} plan allows ${limit} requests per ${WINDOW_SECONDS} seconds.`,
        retry_after: `${ttl > 0 ? ttl : WINDOW_SECONDS} seconds`,
      });
    }

    // 5. Request is allowed — proceed
    next();
  } catch (err) {
    console.error('[rateLimiter]', err);
    // On Redis/DB failure, fail open (allow the request) to prevent
    // outages from blocking legitimate traffic. Adjust to fail-closed
    // based on your risk tolerance.
    next();
  }
}

module.exports = rateLimiter;
