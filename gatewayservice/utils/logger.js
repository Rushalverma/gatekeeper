'use strict';

const pool = require('../config/db');

/**
 * Asynchronously writes a request event to the request_logs table.
 *
 * IMPORTANT: This function is intentionally called WITHOUT await in the
 * gateway controller. The client response is sent first, then this fires.
 * This keeps gateway latency independent of MySQL write latency.
 *
 * @param {object} params
 * @param {string} params.keyId          - The API key that made the request
 * @param {string} params.endpoint       - The path accessed (e.g., /v1/posts)
 * @param {number} params.statusCode     - HTTP status code sent to client (200, 429, etc.)
 * @param {number} [params.responseTimeMs] - Round-trip time in milliseconds
 */
async function logRequest({ keyId, endpoint, statusCode, responseTimeMs = null }) {
  try {
    await pool.execute(
      `INSERT INTO request_logs (key_id, endpoint_accessed, status_code, response_time_ms)
       VALUES (?, ?, ?, ?)`,
      [keyId, endpoint, statusCode, responseTimeMs]
    );
  } catch (err) {
    // Logging failures must never propagate back to the request cycle.
    // Log to stderr for observability but do not throw.
    console.error('[logger.logRequest] Failed to write log:', err.message);
  }
}

module.exports = { logRequest };
