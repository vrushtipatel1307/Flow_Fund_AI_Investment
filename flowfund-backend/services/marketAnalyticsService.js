/**
 * Technical indicators computed from adjusted closes (no extra Alpha Vantage premium calls).
 */

function sma(values, period) {
  const out = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let s = 0;
    for (let j = 0; j < period; j++) s += values[i - j];
    out[i] = s / period;
  }
  return out;
}

function ema(values, period) {
  const k = 2 / (period + 1);
  const out = new Array(values.length).fill(null);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || Number.isNaN(v)) continue;
    if (prev === null) {
      if (i < period - 1) continue;
      let sum = 0;
      for (let j = 0; j < period; j++) sum += values[i - j];
      prev = sum / period;
      out[i] = prev;
    } else {
      prev = v * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

/** Wilder's RSI, period 14 */
function rsi(values, period = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = values[i] - values[i - 1];
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  out[period] = 100 - 100 / (1 + rs);

  for (let i = period + 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    const RS = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out[i] = 100 - 100 / (1 + RS);
  }
  return out;
}

/** EMA over a series that may contain nulls (uses only numeric points in order). */
function emaSparse(values, period) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  const pts = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v != null && !Number.isNaN(v)) pts.push({ i, v });
  }
  if (pts.length < period) return out;
  let prev = null;
  for (let s = 0; s < pts.length; s++) {
    const { i, v } = pts[s];
    if (prev === null) {
      if (s < period - 1) continue;
      let sum = 0;
      for (let j = 0; j < period; j++) sum += pts[s - j].v;
      prev = sum / period;
      out[i] = prev;
    } else {
      prev = v * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function macd(values) {
  const ema12 = ema(values, 12);
  const ema26 = ema(values, 26);
  const line = values.map((_, i) =>
    ema12[i] != null && ema26[i] != null ? ema12[i] - ema26[i] : null
  );
  const signal = emaSparse(line, 9);
  const hist = line.map((v, i) =>
    v != null && signal[i] != null ? v - signal[i] : null
  );
  return { macdLine: line, signal, hist };
}

/** Annualized volatility from log returns, rolling window */
function rollingVolatility(values, window = 20) {
  const out = new Array(values.length).fill(null);
  for (let i = window; i < values.length; i++) {
    const rets = [];
    for (let j = i - window + 1; j <= i; j++) {
      const a = values[j - 1];
      const b = values[j];
      if (a > 0 && b > 0) rets.push(Math.log(b / a));
    }
    if (rets.length < window) continue;
    const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
    const variance =
      rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
    out[i] = Math.sqrt(variance) * Math.sqrt(252) * 100; // % annualized
  }
  return out;
}

/**
 * @param {Array<{ date: string, adjClose: number }>} rows sorted asc
 * @param {number} [maxDays] trim to last N trading rows
 */
function enrichSeries(rows, maxDays = 252) {
  const slice = maxDays > 0 ? rows.slice(-maxDays) : rows;
  const closes = slice.map((r) => r.adjClose);

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const rsi14 = rsi(closes, 14);
  const { macdLine, signal, hist } = macd(closes);
  const vol20 = rollingVolatility(closes, 20);

  const series = slice.map((r, i) => ({
    ...r,
    sma20: sma20[i],
    sma50: sma50[i],
    rsi14: rsi14[i],
    macd: macdLine[i],
    macdSignal: signal[i],
    macdHist: hist[i],
    volatility20: vol20[i],
  }));

  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  let changePct = null;
  if (last && prev && prev.adjClose) {
    changePct = ((last.adjClose - prev.adjClose) / prev.adjClose) * 100;
  }

  const vols = series.map((s) => s.volatility20).filter((v) => v != null);
  const avgVol =
    vols.length > 0 ? vols.reduce((a, b) => a + b, 0) / vols.length : null;

  return {
    series,
    summary: {
      lastPrice: last?.adjClose ?? null,
      lastDate: last?.date ?? null,
      changePct1d: changePct != null ? Math.round(changePct * 100) / 100 : null,
      avgVolatility20: avgVol != null ? Math.round(avgVol * 100) / 100 : null,
      lastRsi: last?.rsi14 != null ? Math.round(last.rsi14 * 100) / 100 : null,
    },
  };
}

/**
 * Align two series on date intersection; normalized index (first = 100).
 */
function comparisonSeries(rowsA, rowsB, maxPoints = 180) {
  const mapB = new Map(rowsB.map((r) => [r.date, r.adjClose]));
  const paired = [];
  for (const r of rowsA) {
    const b = mapB.get(r.date);
    if (b != null) paired.push({ date: r.date, a: r.adjClose, b });
  }
  const tail = paired.slice(-maxPoints);
  if (tail.length === 0) return [];
  const a0 = tail[0].a;
  const b0 = tail[0].b;
  return tail.map((p) => ({
    date: p.date,
    aIndex: a0 ? (p.a / a0) * 100 : null,
    bIndex: b0 ? (p.b / b0) * 100 : null,
  }));
}

module.exports = {
  enrichSeries,
  comparisonSeries,
};
