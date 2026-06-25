'use strict';

const express      = require('express');
const authenticate = require('../middleware/authenticate');
const { getUsage, getKeysSummary } = require('../controllers/analyticsController');

const router = express.Router();

// All analytics routes require a valid JWT
router.use(authenticate);

// GET /api/analytics/usage          — daily aggregated stats for last 7 days
router.get('/usage', getUsage);

// GET /api/analytics/keys-summary   — per-key request breakdown
router.get('/keys-summary', getKeysSummary);

module.exports = router;
