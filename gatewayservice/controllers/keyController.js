'use strict';

const crypto = require('crypto');
const pool   = require('../config/db');

// ─── POST /api/keys/generate ──────────────────────────────────────────────────

/**
 * Generates a new cryptographically secure API key for the authenticated user.
 * Format: gw_live_<64 random hex chars>
 */
async function generateKey(req, res) {
  const userId = req.user.userId;

  try {
    // crypto.randomBytes is the correct approach — Math.random() is never acceptable
    // for security-sensitive key generation.
    const rawSecret = crypto.randomBytes(32).toString('hex'); // 256 bits of entropy
    const keyId     = `gw_live_${rawSecret}`;

    await pool.execute(
      'INSERT INTO api_keys (key_id, user_id, status) VALUES (?, ?, ?)',
      [keyId, userId, 'ACTIVE']
    );

    return res.status(201).json({
      message: 'API key generated successfully.',
      key: {
        key_id:     keyId,
        status:     'ACTIVE',
        created_at: new Date().toISOString(),
        // Security note: this is the ONLY time the full key is returned.
        // Store it securely — it cannot be retrieved again.
      },
      warning: 'Copy this key now. It will not be shown again.',
    });
  } catch (err) {
    console.error('[keyController.generateKey]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── GET /api/keys ────────────────────────────────────────────────────────────

/**
 * Lists all ACTIVE API keys belonging to the authenticated user.
 * Returns a masked version (first 16 chars + '...' ) of each key for display.
 */
async function listKeys(req, res) {
  const userId = req.user.userId;

  try {
    const [rows] = await pool.execute(
      `SELECT key_id, status, created_at
       FROM api_keys
       WHERE user_id = ? AND status = 'ACTIVE'
       ORDER BY created_at DESC`,
      [userId]
    );

    const keys = rows.map(k => ({
      key_id:     k.key_id,
      key_masked: k.key_id.substring(0, 20) + '...',
      status:     k.status,
      created_at: k.created_at,
    }));

    return res.status(200).json({ keys });
  } catch (err) {
    console.error('[keyController.listKeys]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── DELETE /api/keys/:keyId ──────────────────────────────────────────────────

/**
 * Revokes an API key. Uses soft-delete (sets status = REVOKED) so that
 * historical request_logs remain intact for analytics queries.
 */
async function revokeKey(req, res) {
  const userId = req.user.userId;
  const { keyId } = req.params;

  try {
    // Ensure the key belongs to the requesting user before revoking
    const [result] = await pool.execute(
      `UPDATE api_keys
       SET status = 'REVOKED'
       WHERE key_id = ? AND user_id = ? AND status = 'ACTIVE'`,
      [keyId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Key not found or already revoked.' });
    }

    try {
      const redis = require('../config/redis');
      await redis.del(`gw:meta:${keyId}`, `gw:rl:${keyId}`);
    } catch (cacheErr) {
      console.warn('[keyController.revokeKey] Cache invalidation failed:', cacheErr.message);
    }

    return res.status(200).json({ message: `Key ${keyId.substring(0, 20)}... has been revoked.` });
  } catch (err) {
    console.error('[keyController.revokeKey]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { generateKey, listKeys, revokeKey };
