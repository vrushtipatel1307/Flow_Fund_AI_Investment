const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { sendMessage } = require('../controllers/chatController');

// POST /api/chat/message — authenticated, sends user question with financial context to Gemini
router.post('/message', authMiddleware, sendMessage);

module.exports = router;
