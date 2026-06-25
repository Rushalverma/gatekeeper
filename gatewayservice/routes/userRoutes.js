'use strict';

const express      = require('express');
const authenticate = require('../middleware/authenticate');
const { getMe, upgradeTier } = require('../controllers/userController');

const router = express.Router();

// All user routes require a valid JWT
router.use(authenticate);

// GET  /api/user/me    — fetch profile + tier info + available upgrades
router.get('/me', getMe);

// PATCH /api/user/tier — upgrade subscription tier
router.patch('/tier', upgradeTier);

module.exports = router;
