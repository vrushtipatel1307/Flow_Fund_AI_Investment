const CAT_ICONS = {
  'Food & Drink':    '🍔',
  'Groceries':       '🛒',
  'Transportation':  '🚗',
  'Entertainment':   '🎬',
  'Shopping':        '🛍️',
  'Health & Fitness':'💪',
  'Education':       '📚',
  'Income':          '💰',
  'Transfer':        '💸',
};

const C = {
  ink:    '#0f2d25',
  brand:  '#1a4d3e',
  border: 'rgba(15,45,37,0.09)',
  muted:  '#6b7c77',
  faint:  '#9aadaa',
  income: '#059669',
  expense:'#e11d48',
  shadow: '0 2px 4px rgba(15,45,37,0.05), 0 8px 24px rgba(15,45,37,0.07)',
  r:      '16px',
  rs:     '10px',
};

function getDateLabel(dateStr) {
  const today = new Date();
  const todayStr     = today.toISOString().slice(0, 10);
  const yest         = new Date(today); yest.setDate(yest.getDate() - 1);
  const yesterStr    = yest.toISOString().slice(0, 10);
  const weekAgo      = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

  if (dateStr === todayStr)  return 'Today';
  if (dateStr === yesterStr) return 'Yesterday';
  if (new Date(dateStr + 'T12:00:00') >= weekAgo) return 'This Week';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function groupByDate(txns) {
  const map = new Map();
  for (const t of txns) {
    const label = getDateLabel(t.transaction_date);
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(t);
  }
  return map;
}

export default function TransactionFeed({ transactions, isDemo, loading, error }) {
  if (loading) {
    return (
      <div style={{ background: '#fff', borderRadius: C.r, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: C.ink }}>Recent Transactions</div>
        </div>
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              height: 52, borderRadius: C.rs,
              background: 'linear-gradient(90deg, #e8ede9 0%, #d4ddd8 50%, #e8ede9 100%)',
              backgroundSize: '400px 100%',
              animation: 'ff-shimmer 1.4s ease infinite',
            }} />
          ))}
        </div>
      </div>
    );
  }

  const groups = groupByDate(transactions);

  return (
    <div style={{ background: '#fff', borderRadius: C.r, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: C.ink }}>Recent Transactions</div>
          <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </div>
        </div>
        {isDemo && (
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em',
            background: 'rgba(217,119,6,0.09)', border: '1px solid rgba(217,119,6,0.25)',
            color: '#d97706', borderRadius: '20px', padding: '2px 9px',
          }}>
            DEMO
          </span>
        )}
      </div>

      {/* Feed */}
      <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
        {error && (
          <div style={{ padding: '16px 24px', fontSize: '13px', color: '#dc2626' }}>{error}</div>
        )}
        {!error && transactions.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '36px' }}>📭</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: C.ink }}>No transactions yet</div>
            <div style={{ fontSize: '12px', color: C.muted }}>Connect a bank account to see your spending</div>
          </div>
        ) : (
          Array.from(groups.entries()).map(([label, txns]) => (
            <div key={label}>
              <div style={{
                padding: '10px 24px 5px',
                fontSize: '11px', fontWeight: 700,
                color: C.faint, textTransform: 'uppercase', letterSpacing: '0.09em',
                background: '#fafbfa',
                borderBottom: `1px solid ${C.border}`,
              }}>
                {label}
              </div>
              {txns.map((txn, i) => {
                const isIncome = txn.transaction_type === 'INCOME';
                const icon = CAT_ICONS[txn.category] || '💳';
                const amt  = parseFloat(txn.amount || 0);
                const merchant = txn.merchant || txn.description || 'Unknown';

                return (
                  <div
                    key={txn.transaction_id || `${label}-${i}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '12px 24px',
                      borderBottom: `1px solid ${C.border}`,
                      cursor: 'default',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f8faf9'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                  >
                    {/* Icon bubble */}
                    <div style={{
                      width: 38, height: 38, borderRadius: '11px', flexShrink: 0,
                      background: isIncome ? 'rgba(5,150,105,0.08)' : '#f3f6f4',
                      border: isIncome ? '1px solid rgba(5,150,105,0.18)' : `1px solid ${C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '17px',
                    }}>
                      {icon}
                    </div>

                    {/* Meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px', fontWeight: 600, color: C.ink,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {merchant}
                      </div>
                      <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>
                        {txn.category || 'Uncategorized'}
                        {txn.pending ? ' · Pending' : ''}
                      </div>
                    </div>

                    {/* Amount */}
                    <div style={{
                      fontSize: '14px', fontWeight: 700,
                      color: isIncome ? C.income : C.expense,
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}>
                      {isIncome ? '+' : '-'}${amt.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
