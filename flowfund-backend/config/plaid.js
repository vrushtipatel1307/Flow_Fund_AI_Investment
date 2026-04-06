const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

let _client = null;

function getPlaidTokenKeyHex() {
  const hex = (process.env.PLAID_TOKEN_KEY || process.env.TOKEN_ENCRYPTION_KEY || '').trim();
  if (!hex) {
    throw new Error(
      'Missing PLAID_TOKEN_KEY or TOKEN_ENCRYPTION_KEY (64-char hex for encrypting Plaid access tokens).'
    );
  }
  if (hex.length !== 64) {
    throw new Error(
      'PLAID_TOKEN_KEY / TOKEN_ENCRYPTION_KEY must be a 64-character hex string. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return hex;
}

function getPlaidClient() {
  if (_client) return _client;

  const requiredEnvVars = ['PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV'];
  for (const key of requiredEnvVars) {
    if (!process.env[key]?.trim()) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  getPlaidTokenKeyHex(); // validate token key exists (same as utils/encrypt.js)

  const plaidEnv = process.env.PLAID_ENV.trim();
  if (!PlaidEnvironments[plaidEnv]) {
    throw new Error(
      `Invalid PLAID_ENV value "${plaidEnv}". Must be one of: ${Object.keys(PlaidEnvironments).join(', ')}`
    );
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[plaidEnv],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  });

  _client = new PlaidApi(configuration);
  return _client;
}

module.exports = getPlaidClient;
