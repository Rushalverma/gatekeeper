'use strict';

const express         = require('express');
const rateLimiter     = require('../middleware/rateLimiter');
const { proxyRequest } = require('../controllers/gatewayController');

const router = express.Router();

/**
 * Catch-all gateway route.
 *
 * Every request to /v1/* passes through:
 *   1. rateLimiter  — validates key, checks Redis Token Bucket
 *   2. proxyRequest — forwards to upstream and logs the result
 *
 * The wildcard ":0" (path param index 0) captures everything after /v1/
 */
router.all('/*', rateLimiter, proxyRequest);

module.exports = router;
