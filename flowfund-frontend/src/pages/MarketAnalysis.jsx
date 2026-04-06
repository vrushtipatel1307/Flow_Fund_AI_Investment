import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Area,
} from 'recharts';
import { getProfile, logout as logoutApi } from '../api/auth';
import AppHeader, { LogoMark } from '../components/AppHeader';
import { marketSearch, marketSeries, marketCompare } from '../api/market';
import { C } from '../theme/flowfundTheme';

function Card({ title, sub, badge, children }) {
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: C.r,
        border: `1px solid ${C.border}`,
        boxShadow: C.shadowSm,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: C.ink }}>{title}</div>
          {sub && <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{sub}</div>}
        </div>
        {badge}
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return '';
  const x = d.slice(5);
  return x;
}

function PriceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 12,
        boxShadow: C.shadowSm,
      }}
    >
      <div style={{ fontWeight: 700, color: C.ink, marginBottom: 6 }}>{label}</div>
      {row?.adjClose != null && (
        <div style={{ color: C.ink }}>Close: ${Number(row.adjClose).toFixed(2)}</div>
      )}
      {row?.sma20 != null && <div style={{ color: C.brand2 }}>SMA 20: ${Number(row.sma20).toFixed(2)}</div>}
      {row?.sma50 != null && <div style={{ color: C.accent }}>SMA 50: ${Number(row.sma50).toFixed(2)}</div>}
    </div>
  );
}

export default function MarketAnalysis() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [symbol, setSymbol] = useState('AAPL');
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const [series, setSeries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [seriesMeta, setSeriesMeta] = useState({
    isMock: true,
    notice: null,
    avSeriesFunction: null,
    alphaVantageOutputSize: 'compact',
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [symB, setSymB] = useState('MSFT');
  const [cmpSeries, setCmpSeries] = useState([]);
  const [cmpMeta, setCmpMeta] = useState({ isMock: true });
  const [cmpLoading, setCmpLoading] = useState(false);
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const h = () => setVw(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    getProfile()
      .then(({ data }) => setProfile(data))
      .finally(() => setProfileLoading(false));
  }, []);

  const loadSeries = useCallback(async (sym) => {
    setLoading(true);
    setErr('');
    try {
      const { data } = await marketSeries(sym, { days: 252 });
      setSeries(data.series || []);
      setSummary(data.summary || null);
      setSeriesMeta({
        isMock: !!data.isMock,
        notice: data.notice || null,
        avSeriesFunction: data.avSeriesFunction || null,
        alphaVantageOutputSize: data.alphaVantageOutputSize || 'compact',
      });
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load market data');
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (symbol) loadSeries(symbol);
  }, [symbol, loadSeries]);

  const debounceRef = useRef(null);
  const runSearch = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!q || q.length < 1) {
        setSearchHits([]);
        return;
      }
      try {
        const { data } = await marketSearch(q);
        setSearchHits(data.matches || []);
      } catch {
        setSearchHits([]);
      }
    }, 400);
  }, []);

  const loadCompare = useCallback(async () => {
    setCmpLoading(true);
    try {
      const { data } = await marketCompare([symbol, symB], 180);
      setCmpSeries(data.series || []);
      setCmpMeta({ isMock: !!data.isMock });
    } catch {
      setCmpSeries([]);
    } finally {
      setCmpLoading(false);
    }
  }, [symbol, symB]);

  useEffect(() => {
    if (tab === 'compare') loadCompare();
  }, [tab, loadCompare]);

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch (_) {}
    localStorage.removeItem('token');
    navigate('/login');
  };

  const chartData = useMemo(() => series.filter((r) => r.adjClose != null), [series]);
  const rsiData = useMemo(() => series.filter((r) => r.rsi14 != null), [series]);
  const macdData = useMemo(() => series.filter((r) => r.macd != null), [series]);

  const isMobile = vw < 640;

  if (profileLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: C.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <LogoMark />
          <div style={{ marginTop: 16, fontSize: 14, color: C.muted }}>Loading…</div>
        </div>
      </div>
    );
  }

  const sourceBadge = (isMock, label) => (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        padding: '2px 9px',
        borderRadius: 20,
        background: isMock ? 'rgba(217,119,6,0.09)' : 'rgba(22,163,74,0.08)',
        border: `1px solid ${isMock ? 'rgba(217,119,6,0.25)' : 'rgba(22,163,74,0.22)'}`,
        color: isMock ? C.warning : C.success,
      }}
    >
      {isMock ? 'MOCK DATA' : label}
    </span>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <AppHeader profile={profile} onLogout={handleLogout} liveData={!seriesMeta.isMock} />

      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: isMobile ? '20px 16px 40px' : '28px 40px 48px',
        }}
      >
        <div style={{ marginBottom: '24px' }}>
          <h1
            style={{
              fontSize: isMobile ? '22px' : '28px',
              fontWeight: 800,
              color: C.ink,
              margin: 0,
              letterSpacing: '-0.025em',
            }}
          >
            Market Analysis
          </h1>
          <p style={{ fontSize: '13px', color: C.muted, margin: '6px 0 0' }}>
            Prices and indicators from <strong style={{ color: C.brand }}>Alpha Vantage</strong>. If the API
            returns a premium or rate-limit message, the app falls back to <strong>simulated</strong> prices
            (smooth waves)—those numbers are <strong>not</strong> real market data.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {['overview', 'compare'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: '8px 18px',
                borderRadius: C.rs,
                border: `1px solid ${tab === t ? C.brand : C.border}`,
                background: tab === t ? C.brand : C.surface,
                color: tab === t ? '#fff' : C.muted,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t === 'overview' ? 'Overview & indicators' : 'Comparison'}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <Card
              title="Stock search"
              sub="Powered by Alpha Vantage SYMBOL_SEARCH"
              badge={sourceBadge(seriesMeta.isMock, 'ALPHA VANTAGE')}
            >
              <div ref={searchRef} style={{ position: 'relative', maxWidth: 480 }}>
                <input
                  value={searchQ}
                  onChange={(e) => {
                    setSearchQ(e.target.value);
                    runSearch(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search symbol or company…"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: C.rs,
                    border: `1px solid ${C.border}`,
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                {searchOpen && searchHits.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: C.rs,
                      boxShadow: C.shadow,
                      maxHeight: 240,
                      overflowY: 'auto',
                      zIndex: 20,
                    }}
                  >
                    {searchHits.map((m) => (
                      <button
                        key={m.symbol}
                        type="button"
                        onClick={() => {
                          setSymbol(m.symbol);
                          setSearchQ(m.symbol);
                          setSearchOpen(false);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 14px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        <strong style={{ color: C.ink }}>{m.symbol}</strong>
                        <span style={{ color: C.muted, marginLeft: 8 }}>{m.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: C.muted }}>
                Active symbol: <strong style={{ color: C.brand }}>{symbol}</strong>
                {!seriesMeta.isMock && seriesMeta.avSeriesFunction && (
                  <span style={{ display: 'block', marginTop: 6, color: C.success }}>
                    Live series: <code style={{ fontSize: 11 }}>{seriesMeta.avSeriesFunction}</code>
                    {seriesMeta.avSeriesFunction === 'TIME_SERIES_DAILY' &&
                      ' (daily close; splits not adjusted like the adjusted endpoint).'}
                  </span>
                )}
                {!seriesMeta.isMock && seriesMeta.alphaVantageOutputSize === 'compact' && (
                  <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: C.muted }}>
                    Using Alpha Vantage <code style={{ fontSize: 10 }}>outputsize=compact</code> (~100 most
                    recent trading days on the free tier). For full history, use a premium key and set{' '}
                    <code style={{ fontSize: 10 }}>ALPHA_VANTAGE_OUTPUTSIZE=full</code> on the server.
                  </span>
                )}
                {seriesMeta.notice && (
                  <span style={{ display: 'block', marginTop: 6, color: C.warning }}>
                    {seriesMeta.notice}
                  </span>
                )}
              </div>
            </Card>

            {err && (
              <div
                style={{
                  marginTop: 16,
                  padding: '12px 14px',
                  borderRadius: C.rs,
                  background: 'rgba(220,38,38,0.07)',
                  color: C.danger,
                  fontSize: 13,
                }}
              >
                {err}
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
                gap: 12,
                marginTop: 20,
              }}
            >
              {[
                ['Last close', summary?.lastPrice != null ? `$${Number(summary.lastPrice).toFixed(2)}` : '—', summary?.lastDate],
                ['1d change', summary?.changePct1d != null ? `${summary.changePct1d > 0 ? '+' : ''}${summary.changePct1d}%` : '—', ''],
                ['RSI (14)', summary?.lastRsi != null ? String(summary.lastRsi) : '—', 'last bar'],
                ['Volatility (20d ann.)', summary?.avgVolatility20 != null ? `${summary.avgVolatility20}%` : '—', 'avg'],
              ].map(([label, val, sub]) => (
                <div
                  key={label}
                  style={{
                    background: C.surface,
                    borderRadius: C.r,
                    border: `1px solid ${C.border}`,
                    padding: '16px 18px',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: 'uppercase' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, marginTop: 6 }}>{val}</div>
                  {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Card
                title="Price & moving averages"
                sub="Adjusted close with SMA 20 / SMA 50"
                badge={loading ? <span style={{ color: C.muted, fontSize: 12 }}>Loading…</span> : null}
              >
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.chartGrid} />
                      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10 }} stroke={C.muted} />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} stroke={C.muted} width={56} />
                      <Tooltip content={<PriceTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="adjClose" name="Adj. close" stroke={C.brand} dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="sma20" name="SMA 20" stroke={C.brand2} dot={false} strokeWidth={1.5} />
                      <Line type="monotone" dataKey="sma50" name="SMA 50" stroke={C.accent} dot={false} strokeWidth={1.5} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="RSI (14)" sub="Relative strength — reference bands 30 / 70">
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <ComposedChart data={rsiData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.chartGrid} />
                      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10 }} stroke={C.muted} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke={C.muted} width={36} />
                      <ReferenceLine y={70} stroke={C.expense} strokeDasharray="4 4" />
                      <ReferenceLine y={30} stroke={C.income} strokeDasharray="4 4" />
                      <Tooltip />
                      <Area type="monotone" dataKey="rsi14" name="RSI" stroke={C.brand} fill={C.accentFade} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="MACD (12, 26, 9)" sub="Line, signal, histogram">
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <ComposedChart data={macdData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.chartGrid} />
                      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10 }} stroke={C.muted} />
                      <YAxis tick={{ fontSize: 10 }} stroke={C.muted} width={48} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="macdHist" name="Histogram" fill={C.accent} opacity={0.35} />
                      <Line type="monotone" dataKey="macd" name="MACD" stroke={C.brand} dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="macdSignal" name="Signal" stroke={C.expense} dot={false} strokeWidth={1.5} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </>
        )}

        {tab === 'compare' && (
          <Card
            title="Normalized comparison"
            sub="Both series rebased to 100 at the start of the window (overlapping trading days only)"
            badge={sourceBadge(cmpMeta.isMock, 'ALPHA VANTAGE')}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: C.muted }}>
                Symbol A
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  style={{
                    marginLeft: 8,
                    padding: '8px 10px',
                    borderRadius: C.rs,
                    border: `1px solid ${C.border}`,
                    width: 100,
                  }}
                />
              </label>
              <label style={{ fontSize: 12, color: C.muted }}>
                Symbol B
                <input
                  value={symB}
                  onChange={(e) => setSymB(e.target.value.toUpperCase())}
                  style={{
                    marginLeft: 8,
                    padding: '8px 10px',
                    borderRadius: C.rs,
                    border: `1px solid ${C.border}`,
                    width: 100,
                  }}
                />
              </label>
              <button
                type="button"
                onClick={loadCompare}
                disabled={cmpLoading}
                style={{
                  padding: '8px 18px',
                  background: C.brand,
                  color: '#fff',
                  border: 'none',
                  borderRadius: C.rs,
                  fontWeight: 600,
                  cursor: cmpLoading ? 'wait' : 'pointer',
                }}
              >
                {cmpLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
              Two Alpha Vantage calls are spaced ~1.3s apart to reduce free-tier throttling.
            </p>
            <div style={{ width: '100%', height: 340 }}>
              <ResponsiveContainer>
                <ComposedChart data={cmpSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.chartGrid} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10 }} stroke={C.muted} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} stroke={C.muted} width={44} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="aIndex" name={symbol} stroke={C.brand} dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="bIndex" name={symB} stroke={C.accent} dot={false} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
