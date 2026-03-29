const { GoogleGenAI } = require('@google/genai');

let _client = null;

function getGeminiClient() {
  if (_client) return _client;

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing required environment variable: GEMINI_API_KEY');
  }

  _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _client;
}

module.exports = getGeminiClient;
