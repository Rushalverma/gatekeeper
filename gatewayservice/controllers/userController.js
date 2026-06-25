'use strict';

const pool = require('../config/db');

// ─── Tier definitions (single source of truth) ────────────────────────────────

const TIERS = {
  FREE:       { rate_limit_per_minute: 100,    max_keys: 3,   price_usd: 0   },
  PRO:        { rate_limit_per_minute: 10000,  max_keys: 20,  price_usd: 29  },
  ENTERPRISE: { rate_limit_per_minute: 100000, max_keys: 100, price_usd: 199 },
};

// Allowed upgrade paths (no downgrades via this endpoint)
const UPGRADE_PATH = { FREE: ['PRO', 'ENTERPRISE'], PRO: ['ENTERPRISE'], ENTERPRISE: [] };

// ─── GET /api/user/me ──────────────────────────────────────────────────────────

/**
 * Returns the authenticated user's profile + tier details.
 */
async function getMe(req, res) {
  const { userId, email, tier } = req.user;

  try {
    const [rows] = await pool.execute(
      'SELECT id, email, subscription_tier, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = rows[0];
    const currentTier = user.subscription_tier;

    return res.status(200).json({
      user: {
        id:                user.id,
        email:             user.email,
        subscription_tier: currentTier,
        created_at:        user.created_at,
      },
      tier_details:    TIERS[currentTier],
      available_tiers: Object.entries(TIERS).map(([name, details]) => ({
        name,
        ...details,
        is_current:        name === currentTier,
        can_upgrade_to:    UPGRADE_PATH[currentTier]?.includes(name) ?? false,
      })),
    });
  } catch (err) {
    console.error('[userController.getMe]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── PATCH /api/user/tier ──────────────────────────────────────────────────────

/**
 * Upgrades the authenticated user's subscription tier.
 * Body: { tier: 'PRO' | 'ENTERPRISE' }
 *
 * Rules:
 *  - Only upgrades are allowed (FREE→PRO, FREE→ENTERPRISE, PRO→ENTERPRISE).
 *  - Downgrades are rejected with 400.
 *  - The Redis key-metadata cache is automatically invalidated so the new
 *    rate limit takes effect within seconds (cache TTL = 5 min, but we bust it).
 */
async function upgradeTier(req, res) {
  const { userId, tier: currentTier } = req.user;
  const { tier: requestedTier } = req.body;

  // Validate input
  if (!requestedTier) {
    return res.status(400).json({ error: 'tier is required in the request body.' });
  }

  const validTiers = Object.keys(TIERS);
  if (!validTiers.includes(requestedTier)) {
    return res.status(400).json({
      error: `Invalid tier. Must be one of: ${validTiers.join(', ')}.`,
    });
  }

  if (requestedTier === currentTier) {
    return res.status(400).json({ error: `You are already on the ${currentTier} plan.` });
  }

  const allowedUpgrades = UPGRADE_PATH[currentTier] || [];
  if (!allowedUpgrades.includes(requestedTier)) {
    return res.status(400).json({
      error: `Cannot change from ${currentTier} to ${requestedTier}. Only upgrades are permitted.`,
    });
  }

  try {
    // Update tier in the database
    await pool.execute(
      'UPDATE users SET subscription_tier = ? WHERE id = ?',
      [requestedTier, userId]
    );

    // ── Invalidate Redis metadata cache for all user's active keys ────────────
    // This ensures the rate limiter picks up the new limit immediately rather
    // than waiting for the 5-minute cache TTL to expire.
    try {
      const redis = require('../config/redis');
      const [keys] = await pool.execute(
        "SELECT key_id FROM api_keys WHERE user_id = ? AND status = 'ACTIVE'",
        [userId]
      );
      if (keys.length > 0) {
        const cacheKeys = keys.map((k) => `gw:meta:${k.key_id}`);
        await redis.del(...cacheKeys);
      }
    } catch (cacheErr) {
      // Non-fatal: cache will expire naturally; log but don't fail the request
      console.warn('[userController.upgradeTier] Cache invalidation failed:', cacheErr.message);
    }

    const newTierDetails = TIERS[requestedTier];

    return res.status(200).json({
      message:           `Successfully upgraded to ${requestedTier}.`,
      previous_tier:     currentTier,
      new_tier:          requestedTier,
      new_tier_details:  newTierDetails,
      note:              'New rate limits are effective immediately.',
    });
  } catch (err) {
    console.error('[userController.upgradeTier]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { getMe, upgradeTier, TIERS };
