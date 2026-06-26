'use strict';

const redis = require('../config/redis');

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 20;

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.connection?.remoteAddress || 'unknown';
}

async function authRateLimiter(req, res, next) {
  const clientIp = getClientIp(req);
  const key = `gw:auth:${clientIp}`;

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    if (current > MAX_REQUESTS) {
      const ttl = await redis.ttl(key);
      return res.status(429).json({
        error: 'Too many authentication requests.',
        message: `Please wait ${ttl > 0 ? ttl : WINDOW_SECONDS} seconds before trying again.`,
      });
    }

    return next();
  } catch (err) {
    console.error('[authRateLimiter]', err.message);
    return next();
  }
}

module.exports = authRateLimiter;