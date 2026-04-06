/**
 * Deterministic mock OHLCV when Alpha Vantage is unavailable (no key, rate limit, or error).
 */

const SEEDS = {
  AAPL: 172,
  MSFT: 378,
  GOOGL: 140,
  AMZN: 178,
  META: 320,
  NVDA: 485,
  JPM: 185,
  SPY: 475,
};

function hashSymbol(sym) {
  const s = (sym || 'MOCK').toUpperCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Geometric random walk, ~252 trading days */
function buildMockRows(symbol, days = 300) {
  const sym = (symbol || 'MOCK').toUpperCase();
  const base = SEEDS[sym] || 50 + (hashSymbol(sym) % 400);
  const rows = [];
  const today = new Date();
  let price = base;

  for (let i = days; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const date = d.toISOString().slice(0, 10);
    const drift = (Math.sin((days - i) / 40) + (hashSymbol(sym + date) % 17) / 200 - 0.04) * 0.008;
    const shock = ((hashSymbol(date + sym) % 100) / 100 - 0.5) * 0.022;
    price = Math.max(5, price * (1 + drift + shock));

    const hi = price * (1 + Math.abs(shock) * 0.4);
    const lo = price * (1 - Math.abs(shock) * 0.4);
    const open = price * (1 + shock * 0.2);
    const vol = Math.floor(2e6 + (hashSymbol(sym + date) % 5e6));

    rows.push({
      date,
      open: Math.round(open * 100) / 100,
      high: Math.round(hi * 100) / 100,
      low: Math.round(lo * 100) / 100,
      close: Math.round(price * 100) / 100,
      adjClose: Math.round(price * 100) / 100,
      volume: vol,
    });
  }

  return rows;
}

function mockSearch(keywords) {
  const q = (keywords || '').toUpperCase();
  const pool = Object.keys(SEEDS).filter((s) => s.includes(q) || q.includes(s.slice(0, 2)));
  const symbols = pool.length > 0 ? pool : ['AAPL', 'MSFT', 'GOOGL'];
  return symbols.slice(0, 8).map((symbol) => ({
    symbol,
    name: `${symbol} Inc. (mock)`,
    type: 'Equity',
    region: 'United States',
    currency: 'USD',
  }));
}

/** When SYMBOL_SEARCH is premium/unavailable, still suggest real tickers (no API). */
const POPULAR_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'AMD', name: 'Advanced Micro Devices' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'DIS', name: 'The Walt Disney Company' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation' },
];

function staticSymbolMatches(keywords) {
  const q = (keywords || '').trim().toUpperCase();
  if (!q) return [];
  return POPULAR_SYMBOLS.filter(
    (p) => p.symbol.includes(q) || p.name.toUpperCase().includes(q)
  ).slice(0, 12);
}

module.exports = { buildMockRows, mockSearch, staticSymbolMatches };
