const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getSnapshot, getTransactions } = require('../controllers/financialController');

router.get('/snapshot', authMiddleware, getSnapshot);
router.get('/transactions', authMiddleware, getTransactions);

module.exports = router;
