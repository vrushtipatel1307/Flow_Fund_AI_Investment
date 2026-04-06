const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { search, series, compare } = require('../controllers/marketController');

router.get('/search', authMiddleware, search);
router.get('/series/:symbol', authMiddleware, series);
router.get('/compare', authMiddleware, compare);

module.exports = router;
