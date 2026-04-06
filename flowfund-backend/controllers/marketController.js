const av = require('../services/alphaVantageService');
const { enrichSeries, comparisonSeries } = require('../services/marketAnalyticsService');
const { buildMockRows, mockSearch, staticSymbolMatches } = require('../services/mockMarketData');

exports.search = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 1) return res.json({ matches: [], isMock: true, source: 'none' });

    const hasKey = !!av.getApiKey();
    if (!hasKey) {
      return res.json({ matches: mockSearch(q), isMock: true, source: 'mock' });
    }

    const r = await av.symbolSearch(q);
    let matches = r.matches || [];
    let isMock = false;
    let source = 'alphavantage';
    if (matches.length === 0) {
      const staticHits = staticSymbolMatches(q);
      if (staticHits.length > 0) {
        matches = staticHits;
        source = 'static';
      } else {
        matches = mockSearch(q);
        isMock = true;
        source = 'mock';
      }
    }
    res.json({
      matches,
      isMock,
      source,
      notice: r.rawNote || undefined,
    });
  } catch (err) {
    console.error('market search:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
};

exports.series = async (req, res) => {
  try {
    const symbol = String(req.params.symbol || '').trim();
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });

    const days = Math.min(3660, Math.max(30, parseInt(req.query.days || '252', 10)));
    const outputsize = av.resolveOutputSize();

    let rows = [];
    let isMock = false;
    let meta = {};
    let notice;
    let avSeriesFunction = null;

    if (av.getApiKey()) {
      const r = await av.fetchDailySeries(symbol, { outputsize });
      rows = r.rows || [];
      meta = r.meta || {};
      avSeriesFunction = r.avSeriesFunction;
      notice = r.rawNote || undefined;
      if (!rows.length) {
        isMock = true;
        rows = buildMockRows(symbol, days + 80);
        avSeriesFunction = null;
        notice =
          notice ||
          'No price series returned (check API key, rate limits, or symbol). Showing simulated data.';
      }
    } else {
      isMock = true;
      rows = buildMockRows(symbol, days + 80);
      notice = 'ALPHA_VANTAGE_API_KEY is not set. Showing simulated data.';
    }

    const trimmed = rows.slice(-days);
    const { series, summary } = enrichSeries(trimmed, trimmed.length);

    res.json({
      symbol: symbol.toUpperCase(),
      isMock,
      source: isMock ? 'mock' : 'alphavantage',
      avSeriesFunction,
      alphaVantageOutputSize: outputsize,
      meta,
      series,
      summary,
      notice,
    });
  } catch (err) {
    console.error('market series:', err.message);
    res.status(500).json({ error: 'Failed to load series' });
  }
};

exports.compare = async (req, res) => {
  try {
    const raw = String(req.query.symbols || '');
    const symbols = raw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 2);

    if (symbols.length < 2) {
      return res.status(400).json({ error: 'Provide two symbols: ?symbols=AAPL,MSFT' });
    }

    const days = Math.min(730, Math.max(60, parseInt(req.query.days || '180', 10)));
    const outputsize = av.resolveOutputSize();

    let rowsA;
    let rowsB;
    let isMock = !av.getApiKey();

    if (av.getApiKey()) {
      const r1 = await av.fetchDailySeries(symbols[0], { outputsize });
      rowsA = r1.rows?.length ? r1.rows : buildMockRows(symbols[0], days + 80);
      if (!r1.rows?.length) isMock = true;
      await new Promise((resolve) => setTimeout(resolve, 1300));
      const r2 = await av.fetchDailySeries(symbols[1], { outputsize });
      rowsB = r2.rows?.length ? r2.rows : buildMockRows(symbols[1], days + 80);
      if (!r2.rows?.length) isMock = true;
    } else {
      rowsA = buildMockRows(symbols[0], days + 80);
      rowsB = buildMockRows(symbols[1], days + 80);
    }

    const cmp = comparisonSeries(rowsA.slice(-days), rowsB.slice(-days), days);

    res.json({
      symbols,
      isMock,
      source: isMock ? 'mock' : 'alphavantage',
      alphaVantageOutputSize: outputsize,
      series: cmp,
    });
  } catch (err) {
    console.error('market compare:', err.message);
    res.status(500).json({ error: 'Comparison failed' });
  }
};
