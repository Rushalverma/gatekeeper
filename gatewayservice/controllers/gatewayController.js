'use strict';

const axios       = require('axios');
const { logRequest } = require('../utils/logger');

const PROXY_TARGET = process.env.PROXY_TARGET || 'https://jsonplaceholder.typicode.com';

/**
 * Gateway Controller
 *
 * Forwards the incoming request to the configured PROXY_TARGET and streams
 * the response back to the client.
 *
 * Called only after rateLimiterMiddleware has passed the request (next()),
 * so req.apiKey, req.keyOwner, and req.rateLimit are always available here.
 */
async function proxyRequest(req, res) {
  // Strip the /v1 prefix before forwarding
  // e.g. GET /v1/posts/1  →  GET https://jsonplaceholder.typicode.com/posts/1
  const targetPath = req.params[0] || '/';
  const targetUrl  = `${PROXY_TARGET}/${targetPath}`;

  // Build forwarded headers — remove internal headers that should not leak
  const forwardHeaders = { ...req.headers };
  delete forwardHeaders['x-api-key'];     // never forward our gateway key
  delete forwardHeaders['host'];          // prevents host header mismatch
  delete forwardHeaders['content-length']; // axios sets this correctly

  const startTime = process.hrtime.bigint(); // nanosecond precision timer

  try {
    const upstreamResponse = await axios({
      method:  req.method,
      url:     targetUrl,
      headers: forwardHeaders,
      params:  req.query,
      data:    ['GET', 'HEAD', 'DELETE'].includes(req.method.toUpperCase())
               ? undefined
               : req.body,
      validateStatus: () => true, // don't throw on 4xx/5xx from upstream
      timeout: 10_000,            // 10 second upstream timeout
    });

    const elapsedMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

    // Forward upstream status code and headers to the client
    res.status(upstreamResponse.status);

    // Selectively forward safe upstream headers
    const SAFE_HEADERS = ['content-type', 'cache-control', 'etag', 'last-modified'];
    SAFE_HEADERS.forEach(h => {
      if (upstreamResponse.headers[h]) {
        res.set(h, upstreamResponse.headers[h]);
      }
    });

    // Add our own gateway header for transparency
    res.set('X-Gateway', 'api-gateway-saas');
    res.set('X-Response-Time', `${elapsedMs.toFixed(2)}ms`);

    // Send response to client FIRST, then log asynchronously
    res.json(upstreamResponse.data);

    // ── Fire-and-forget async log ───────────────────────────────────────────
    // No `await` — the client has already received their response.
    logRequest({
      keyId:          req.apiKey,
      endpoint:       req.originalUrl,
      statusCode:     upstreamResponse.status,
      responseTimeMs: Math.round(elapsedMs),
    });

  } catch (err) {
    const elapsedMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

    // If upstream is unreachable, return a clean 502
    const statusCode = 502;
    res.status(statusCode).json({
      error:   'Bad Gateway.',
      message: 'The upstream service is currently unavailable.',
    });

    // Still log the failed request
    logRequest({
      keyId:          req.apiKey,
      endpoint:       req.originalUrl,
      statusCode,
      responseTimeMs: Math.round(elapsedMs),
    });

    console.error('[gatewayController.proxyRequest] Upstream error:', err.message);
  }
}

module.exports = { proxyRequest };
