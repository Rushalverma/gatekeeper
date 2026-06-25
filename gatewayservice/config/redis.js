'use strict';

const Redis = require('ioredis');
require('dotenv').config();

/**
 * Redis singleton client using ioredis.
 * ioredis automatically handles reconnects with exponential backoff.
 */
const redisClient = new Redis({
  host:               process.env.REDIS_HOST     || 'localhost',
  port:               parseInt(process.env.REDIS_PORT || '6379', 10),
  password:           process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    // Reconnect after min(times * 100ms, 3000ms)
    const delay = Math.min(times * 100, 3000);
    console.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${times})...`);
    return delay;
  },
  lazyConnect: false,
});

redisClient.on('connect', () => {
  console.log('[Redis] Connected successfully.');
});

redisClient.on('error', (err) => {
  // ioredis will auto-reconnect; we just log the error
  console.error('[Redis] Error:', err.message);
});

module.exports = redisClient;
