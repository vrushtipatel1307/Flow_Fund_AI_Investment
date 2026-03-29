const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getSnapshot } = require('../controllers/financialController');

// GET /api/financial/snapshot — returns structured financial summary for authenticated user
router.get('/snapshot', authMiddleware, getSnapshot);

module.exports = router;
