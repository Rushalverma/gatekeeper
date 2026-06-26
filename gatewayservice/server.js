'use strict';

require('dotenv').config();

const express          = require('express');
const cors             = require('cors');

// ─── Config modules (initialise connections at startup) ───────────────────────
require('./config/db');     // MySQL pool — logs success/failure on connect
require('./config/redis');  // Redis client — logs success/failure on connect

// ─── Routes ──────────────────────────────────────────────────────────────────
const authRoutes      = require('./routes/authRoutes');
const keyRoutes       = require('./routes/keyRoutes');
const gatewayRoutes   = require('./routes/gatewayRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const userRoutes      = require('./routes/userRoutes');
const authRateLimiter = require('./middleware/authRateLimiter');

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ─── CORS — allow the Vite dev server and any deployed frontend ──────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Root — API Info ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'API Rate-Limiting & Gateway SaaS',
    version: '1.0.0',
    status:  'running',
    endpoints: {
      register:  'POST /auth/register',
      login:     'POST /auth/login',
      generateKey: 'POST /api/keys/generate  (JWT required)',
      listKeys:  'GET  /api/keys             (JWT required)',
      revokeKey: 'DELETE /api/keys/:keyId    (JWT required)',
      gateway:   'ALL  /v1/*                 (x-api-key header required)',
      analytics: 'GET  /api/analytics/usage  (JWT required)',
      userProfile: 'GET  /api/user/me         (JWT required)',
      upgradeTier: 'PATCH /api/user/tier      (JWT required)',
      health:    'GET  /health',
    },
    docs: 'Add your API key to the X-Api-Key header to use the gateway.',
  });
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status:  'ok',
    service: 'api-gateway-saas',
    time:    new Date().toISOString(),
  });
});

// ─── Route Mounting ───────────────────────────────────────────────────────────
app.use('/auth', authRateLimiter);
app.use('/auth',            authRoutes);        // POST /auth/register, /auth/login
app.use('/api/keys',        keyRoutes);         // POST /api/keys/generate, GET /api/keys
app.use('/api/analytics',   analyticsRoutes);   // GET  /api/analytics/usage
app.use('/api/user',        userRoutes);        // GET  /api/user/me, PATCH /api/user/tier
app.use('/v1',              gatewayRoutes);     // ALL  /v1/* → rate limiter → proxy

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[GlobalErrorHandler]', err);
  res.status(500).json({ error: 'An unexpected internal error occurred.' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);

const server = app.listen(PORT, () => {
  console.log(`\n🚀  API Gateway SaaS running on http://localhost:${PORT}`);
  console.log(`    Health:    GET  http://localhost:${PORT}/health`);
  console.log(`    Register:  POST http://localhost:${PORT}/auth/register`);
  console.log(`    Gateway:   ALL  http://localhost:${PORT}/v1/*`);
  console.log(`    Proxy →    ${process.env.PROXY_TARGET}\n`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[${signal}] Graceful shutdown initiated...`);

  server.close(async () => {
    console.log('[Shutdown] HTTP server closed.');

    try {
      const pool  = require('./config/db');
      const redis = require('./config/redis');
      await pool.end();
      console.log('[Shutdown] MySQL pool closed.');
      await redis.quit();
      console.log('[Shutdown] Redis client closed.');
    } catch (err) {
      console.error('[Shutdown] Error during cleanup:', err.message);
    }

    process.exit(0);
  });

  // Force-exit after 10 seconds if graceful close hangs
  setTimeout(() => {
    console.error('[Shutdown] Forced exit after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
