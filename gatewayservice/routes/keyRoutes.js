'use strict';

const express      = require('express');
const authenticate = require('../middleware/authenticate');
const { generateKey, listKeys, revokeKey } = require('../controllers/keyController');

const router = express.Router();

// All key management routes require a valid JWT
router.use(authenticate);

// POST /api/keys/generate   — generate a new API key
router.post('/generate', generateKey);

// GET  /api/keys            — list all active keys
router.get('/', listKeys);

// DELETE /api/keys/:keyId   — revoke a specific key
router.delete('/:keyId', revokeKey);

module.exports = router;
