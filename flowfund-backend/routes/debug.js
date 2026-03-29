const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/debug/ai-health  — requires valid JWT, never exposes secrets
router.get('/ai-health', authMiddleware, async (req, res) => {
  const report = {
    backend: 'alive',
    geminiKeyPresent: !!process.env.GEMINI_API_KEY,
    geminiModel: 'gemini-2.5-flash',
    sdkPackage: '@google/genai',
    sdkInitialized: false,
    testResponse: null,
    error: null,
  };

  try {
    const getGeminiClient = require('../config/gemini');
    const ai = getGeminiClient();
    report.sdkInitialized = true;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Reply with exactly: OK',
    });
    report.testResponse = result.text?.trim() || '(empty)';
  } catch (err) {
    report.error = err.message;
  }

  res.json(report);
});

module.exports = router;
