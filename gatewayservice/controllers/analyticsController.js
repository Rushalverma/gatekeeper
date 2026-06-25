'use strict';

const pool   = require('../config/db');

// ─── Tier → daily rate limit caps ─────────────────────────────────────────────

const RATE_LIMITS = {
  FREE:       100,     // 100 req / 60 seconds
  PRO:        10000,   // 10,000 req / 60 seconds
  ENTERPRISE: 100000,  // 100,000 req / 60 seconds
};

const WINDOW_SECONDS = 60;

// ─── GET /api/analytics/usage ─────────────────────────────────────────────────

/**
 * Returns per-day aggregated traffic stats for the last 7 days.
 *
 * Response shape:
 * {
 *   period: "last_7_days",
 *   tier: "FREE",
 *   rate_limit_per_minute: 100,
 *   data: [
 *     {
 *       date: "2024-07-01",
 *       total_requests: 542,
 *       successful_requests: 500,
 *       blocked_requests: 42,
 *       avg_response_time_ms: 18.3
 *     },
 *     ...
 *   ]
 * }
 */
async function getUsage(req, res) {
  const { userId, tier } = req.user;

  try {
    const [rows] = await pool.execute(
      `SELECT
         DATE(rl.timestamp)                                                AS date,
         COUNT(*)                                                          AS total_requests,
         SUM(CASE WHEN rl.status_code = 429 THEN 1 ELSE 0 END)           AS blocked_requests,
         SUM(CASE WHEN rl.status_code != 429 THEN 1 ELSE 0 END)          AS successful_requests,
         ROUND(AVG(rl.response_time_ms), 2)                              AS avg_response_time_ms
       FROM request_logs rl
       JOIN api_keys ak ON rl.key_id = ak.key_id
       WHERE ak.user_id = ?
         AND rl.timestamp >= NOW() - INTERVAL 7 DAY
       GROUP BY DATE(rl.timestamp)
       ORDER BY date DESC`,
      [userId]
    );

    return res.status(200).json({
      period:                 'last_7_days',
      tier,
      rate_limit_per_minute:  RATE_LIMITS[tier] || RATE_LIMITS.FREE,
      window_seconds:         WINDOW_SECONDS,
      data:                   rows,
    });
  } catch (err) {
    console.error('[analyticsController.getUsage]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── GET /api/analytics/keys-summary ─────────────────────────────────────────

/**
 * Returns per-key request counts over the last 7 days — useful for a
 * multi-key developer seeing which integration is driving most traffic.
 */
async function getKeysSummary(req, res) {
  const { userId } = req.user;

  try {
    const [rows] = await pool.execute(
      `SELECT
         rl.key_id,
         COUNT(*)                                                AS total_requests,
         SUM(CASE WHEN rl.status_code = 429 THEN 1 ELSE 0 END) AS blocked_requests,
         MAX(rl.timestamp)                                       AS last_seen
       FROM request_logs rl
       JOIN api_keys ak ON rl.key_id = ak.key_id
       WHERE ak.user_id = ?
         AND rl.timestamp >= NOW() - INTERVAL 7 DAY
       GROUP BY rl.key_id
       ORDER BY total_requests DESC`,
      [userId]
    );

    // Mask the key IDs in the response for security
    const masked = rows.map(r => ({
      ...r,
      key_id: r.key_id.substring(0, 20) + '...',
    }));

    return res.status(200).json({ keys: masked });
  } catch (err) {
    console.error('[analyticsController.getKeysSummary]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { getUsage, getKeysSummary };
