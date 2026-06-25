'use strict';

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool   = require('../config/db');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Signs a JWT with the user's ID, email, and subscription tier embedded.
 * The tier is included so the rate limiter can quickly decode it without
 * a DB round-trip on dashboard-facing routes.
 */
function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, tier: user.subscription_tier },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ─── POST /auth/register ──────────────────────────────────────────────────────

/**
 * Registers a new developer account.
 * Body: { email, password }
 */
async function register(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    await pool.execute(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      [userId, email.toLowerCase().trim(), passwordHash]
    );

    const token = signToken({ id: userId, email, subscription_tier: 'FREE' });

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: { id: userId, email, subscription_tier: 'FREE' },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    console.error('[authController.register]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── POST /auth/login ─────────────────────────────────────────────────────────

/**
 * Authenticates an existing developer.
 * Body: { email, password }
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, email, password_hash, subscription_tier FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      // Generic message — do not leak whether the email exists
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user.id, email: user.email, subscription_tier: user.subscription_tier },
    });
  } catch (err) {
    console.error('[authController.login]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { register, login };
