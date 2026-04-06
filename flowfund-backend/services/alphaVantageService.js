/**
 * Alpha Vantage market data (server-side only — API key stays off the client).
 * Free tier: ~25 requests/day and ~1 call/sec — queue + cache aggressively.
 * @see https://www.alphavantage.co/documentation/
 */

const BASE = 'https://www.alphavantage.co/query';

/** Space every HTTP call; avoids Note spam when adjusted + daily run back-to-back. */
const MIN_MS_BETWEEN_CALLS = Math.max(
  1100,
  parseInt(process.env.ALPHA_VANTAGE_MIN_INTERVAL_MS || '1200', 10) || 1200
);

/** EOD series changes once per day; long TTL saves the 25/day budget on refresh. */
const SERIES_CACHE_MS = Math.max(
  60_000,
  parseInt(process.env.ALPHA_VANTAGE_SERIES_CACHE_MS || String(6 * 60 * 60 * 1000), 10) ||
    6 * 60 * 60 * 1000
);

const SEARCH_HIT_CACHE_MS = 30 * 60 * 1000;
const SEARCH_MISS_CACHE_MS = 90 * 1000;

function getApiKey() {
  return (process.env.ALPHA_VANTAGE_API_KEY || process.env.ALPHAVANTAGE_API_KEY || '').trim();
}

/**
 * Alpha Vantage: outputsize=compact (~100 points) is free; outputsize=full requires premium.
 * Set ALPHA_VANTAGE_OUTPUTSIZE=full only with a paid key.
 */
function resolveOutputSize() {
  const v = (process.env.ALPHA_VANTAGE_OUTPUTSIZE || 'compact').toLowerCase().trim();
  return v === 'full' ? 'full' : 'compact';
}

const cache = new Map(); // key -> { at, payload }

let avQueue = Promise.resolve();
let lastAvCallAt = 0;

function cacheGet(key, ttlMs) {
  const row = cache.get(key);
  if (!row) return null;
  if (Date.now() - row.at > ttlMs) {
    cache.delete(key);
    return null;
  }
  return row.payload;
}

function cacheSet(key, payload) {
  cache.set(key, { at: Date.now(), payload });
}

function cacheGetSymbolSearch(key) {
  const row = cache.get(key);
  if (!row) return null;
  const hit = row.payload?.matches?.length > 0;
  const ttl = hit ? SEARCH_HIT_CACHE_MS : SEARCH_MISS_CACHE_MS;
  if (Date.now() - row.at > ttl) {
    cache.delete(key);
    return null;
  }
  return row.payload;
}

function isRateLimitOrError(body) {
  if (!body || typeof body !== 'object') return true;
  if (body.Note || body.Information || body['Error Message']) return true;
  return false;
}

/**
 * Serializes Alpha Vantage HTTP calls and enforces minimum spacing (free-tier friendly).
 */
function fetchAv(params) {
  const apikey = getApiKey();
  if (!apikey) return Promise.resolve({ error: 'missing_key', body: null });

  const run = avQueue.then(async () => {
    const wait = Math.max(0, MIN_MS_BETWEEN_CALLS - (Date.now() - lastAvCallAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    const url = new URL(BASE);
    Object.entries({ ...params, apikey }).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'FlowFundAI/1.0' },
    });
    lastAvCallAt = Date.now();
    if (!res.ok) return { error: `http_${res.status}`, body: null };
    const body = await res.json();
    if (isRateLimitOrError(body)) return { error: 'av_limit_or_error', body };
    return { error: null, body };
  });

  avQueue = run.catch(() => {});
  return run;
}

/**
 * @param {string} keywords
 * @returns {Promise<{ matches: object[], rawNote?: string }>}
 */
async function symbolSearch(keywords) {
  const q = (keywords || '').trim();
  if (q.length < 1) return { matches: [] };

  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = cacheGetSymbolSearch(cacheKey);
  if (cached) return cached;

  const { error, body } = await fetchAv({
    function: 'SYMBOL_SEARCH',
    keywords: q,
  });

  if (error || !body?.bestMatches) {
    const out = { matches: [], error: error || 'no_results', rawNote: body?.Note || body?.Information };
    cacheSet(cacheKey, out);
    return out;
  }

  const matches = body.bestMatches.map((m) => ({
    symbol: m['1. symbol'],
    name: m['2. name'],
    type: m['3. type'],
    region: m['4. region'],
    currency: m['8. currency'],
  }));

  const out = { matches };
  cacheSet(cacheKey, out);
  return out;
}

/**
 * Daily adjusted OHLCV, ascending by date.
 * @param {string} symbol
 * @param {{ outputsize?: 'compact'|'full' }} opts
 */
async function timeSeriesDailyAdjusted(symbol, opts = {}) {
  const sym = (symbol || '').toUpperCase().replace(/[^A-Z0-9.-]/g, '');
  if (!sym) return { error: 'bad_symbol', rows: [] };

  const outputsize = opts.outputsize === 'full' ? 'full' : 'compact';
  const cacheKey = `daily_adj:${sym}:${outputsize}`;
  const cached = cacheGet(cacheKey, SERIES_CACHE_MS);
  if (cached?.rows?.length) return cached;

  const { error, body } = await fetchAv({
    function: 'TIME_SERIES_DAILY_ADJUSTED',
    symbol: sym,
    outputsize,
  });

  if (error || !body['Time Series (Daily)']) {
    const out = {
      rows: [],
      error: error || 'no_series',
      meta: body?.['Meta Data'] || null,
      rawNote: body?.Note || body?.Information,
    };
    return out;
  }

  const ts = body['Time Series (Daily)'];
  const rows = Object.entries(ts)
    .map(([date, o]) => ({
      date,
      open: parseFloat(o['1. open']),
      high: parseFloat(o['2. high']),
      low: parseFloat(o['3. low']),
      close: parseFloat(o['4. close']),
      adjClose: parseFloat(o['5. adjusted close']),
      volume: parseInt(o['6. volume'], 10) || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const out = {
    rows,
    error: null,
    meta: body['Meta Data'] || {},
    symbol: sym,
  };
  cacheSet(cacheKey, out);
  return out;
}

/**
 * Standard daily OHLCV (often still on free tier when DAILY_ADJUSTED is restricted).
 * Uses close as adjClose so downstream indicators stay unchanged.
 */
async function timeSeriesDaily(symbol, opts = {}) {
  const sym = (symbol || '').toUpperCase().replace(/[^A-Z0-9.-]/g, '');
  if (!sym) return { error: 'bad_symbol', rows: [] };

  const outputsize = opts.outputsize === 'full' ? 'full' : 'compact';
  const cacheKey = `daily:${sym}:${outputsize}`;
  const cached = cacheGet(cacheKey, SERIES_CACHE_MS);
  if (cached?.rows?.length) return cached;

  const { error, body } = await fetchAv({
    function: 'TIME_SERIES_DAILY',
    symbol: sym,
    outputsize,
  });

  if (error || !body['Time Series (Daily)']) {
    return {
      rows: [],
      error: error || 'no_series',
      meta: body?.['Meta Data'] || null,
      rawNote: body?.Note || body?.Information,
      symbol: sym,
    };
  }

  const ts = body['Time Series (Daily)'];
  const rows = Object.entries(ts)
    .map(([date, o]) => {
      const close = parseFloat(o['4. close']);
      return {
        date,
        open: parseFloat(o['1. open']),
        high: parseFloat(o['2. high']),
        low: parseFloat(o['3. low']),
        close,
        adjClose: close,
        volume: parseInt(o['5. volume'], 10) || 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const out = {
    rows,
    error: null,
    meta: body['Meta Data'] || {},
    symbol: sym,
  };
  cacheSet(cacheKey, out);
  return out;
}

/**
 * Prefer adjusted series; if Alpha Vantage blocks it (premium / migration), use TIME_SERIES_DAILY.
 */
async function fetchDailySeries(symbol, opts = {}) {
  const sym = (symbol || '').toUpperCase().replace(/[^A-Z0-9.-]/g, '');
  const adjusted = await timeSeriesDailyAdjusted(symbol, opts);
  if (adjusted.rows?.length > 0) {
    return {
      rows: adjusted.rows,
      meta: adjusted.meta,
      rawNote: null,
      avSeriesFunction: 'TIME_SERIES_DAILY_ADJUSTED',
      symbol: sym,
    };
  }

  const daily = await timeSeriesDaily(symbol, opts);
  if (daily.rows?.length > 0) {
    const hint =
      adjusted.rawNote || adjusted.error
        ? 'Adjusted series was unavailable; using TIME_SERIES_DAILY (close ≈ adj. for same-day math).'
        : null;
    return {
      rows: daily.rows,
      meta: daily.meta,
      rawNote: hint,
      avSeriesFunction: 'TIME_SERIES_DAILY',
      symbol: sym,
    };
  }

  return {
    rows: [],
    meta: daily.meta || adjusted.meta,
    rawNote: daily.rawNote || adjusted.rawNote,
    avSeriesFunction: null,
    symbol: sym,
  };
}

module.exports = {
  getApiKey,
  resolveOutputSize,
  symbolSearch,
  timeSeriesDailyAdjusted,
  timeSeriesDaily,
  fetchDailySeries,
};
