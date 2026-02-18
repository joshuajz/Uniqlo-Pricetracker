import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, TrendingDown } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import {
  PRODUCTS, HISTORIES, DATES, WATCHED_IDS,
  discountPct, isAtl, isOnSale, genderLabel,
} from '../data/mockData'
import type { Product, TabKey } from '../types'
import PriceSparkline from '../components/PriceSparkline'

// ─── Stat Card ───────────────────────────────────────────────────────────────

function DashStat({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div style={{
      borderTop: `3px solid ${accent ? '#dc2626' : '#111'}`,
      paddingTop: 12,
    }}>
      <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em' }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginTop: 3 }}>
        {label}
      </div>
    </div>
  )
}

// ─── Expanded Chart ───────────────────────────────────────────────────────────

function PriceChart({ product }: { product: Product }) {
  const history = HISTORIES[product.id] ?? []
  const chartData = history.map((price, i) => ({ date: DATES[i], price }))
  const change = history.length >= 2 ? history[history.length - 1] - history[history.length - 2] : 0

  return (
    <div style={{ padding: '20px 16px 20px 0', borderTop: '1px solid #f0f0f0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
        {/* Chart */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginBottom: 12 }}>
            Price History (10 months)
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${product.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#bbb', fontFamily: 'Inter, sans-serif' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#bbb', fontFamily: 'Inter, sans-serif' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${v}`}
                width={44}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, border: '1px solid #e8e8e8', borderRadius: 0, fontFamily: 'Inter, sans-serif' }}
                formatter={(v: number) => [`$${v.toFixed(2)}`, 'Price']}
              />
              <ReferenceLine
                y={product.lowest}
                stroke="#111"
                strokeDasharray="4 2"
                strokeWidth={1}
                label={{ value: 'ATL', position: 'right', fill: '#555', fontSize: 10 }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#dc2626"
                strokeWidth={2}
                fill={`url(#grad-${product.id})`}
                dot={{ r: 3, fill: '#dc2626', strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Stats + history table */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginBottom: 12 }}>
            Price Log
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[...chartData].reverse().map((row, i) => {
              const isLatest = i === 0
              return (
                <div
                  key={row.date}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '5px 0',
                    borderBottom: '1px solid #f5f5f5',
                    fontSize: 12,
                    background: isLatest ? '#fef2f2' : 'transparent',
                    paddingLeft: isLatest ? 6 : 0,
                    paddingRight: isLatest ? 6 : 0,
                  }}
                >
                  <span style={{ color: isLatest ? '#111' : '#888', fontWeight: isLatest ? 600 : 400 }}>{row.date}</span>
                  <span style={{ fontWeight: isLatest ? 700 : 400, color: isLatest ? '#dc2626' : '#111' }}>
                    ${row.price.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Quick stats */}
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Current', value: `$${product.price.toFixed(2)}` },
              { label: 'Regular', value: `$${product.regular.toFixed(2)}` },
              { label: 'All-Time Low', value: `$${product.lowest.toFixed(2)}` },
              { label: '30d Change', value: change <= 0 ? `−$${Math.abs(change).toFixed(2)}` : `+$${change.toFixed(2)}`, red: change < 0 },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: '#bbb', textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'red' in s && s.red ? '#dc2626' : '#111', marginTop: 2 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard Row ────────────────────────────────────────────────────────────

function DashRow({ product: p, isExpanded, onToggle }: {
  product: Product
  isExpanded: boolean
  onToggle: () => void
}) {
  const history = HISTORIES[p.id] ?? []
  const pct = discountPct(p)
  const atl = isAtl(p)
  const sale = isOnSale(p)
  const savings = p.regular - p.price

  const change = history.length >= 2
    ? history[history.length - 1] - history[history.length - 2]
    : 0

  return (
    <div className="dash-row">
      {/* Row header */}
      <div
        className="dash-row-header"
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 100px 100px 88px 88px 80px 32px',
          alignItems: 'center',
          gap: 12,
          padding: '12px 8px',
          cursor: 'pointer',
          transition: 'background 0.1s',
          margin: '0 -8px',
          paddingLeft: 8,
          paddingRight: 8,
        }}
      >
        {/* Name + category */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
            <span className="badge badge-cat" style={{ background: '#f1f1ef', color: '#777', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', padding: '1px 5px' }}>
              {p.category.toUpperCase()}
            </span>
            <span style={{ fontSize: 11, color: '#bbb' }}>{genderLabel(p.gender)}</span>
          </div>
        </div>

        {/* Sparkline */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <PriceSparkline prices={history} width={80} height={28} />
        </div>

        {/* Current price */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>${p.price.toFixed(2)}</div>
          <div style={{ fontSize: 11, color: '#bbb', textDecoration: 'line-through', marginTop: 1 }}>${p.regular.toFixed(2)}</div>
        </div>

        {/* Change */}
        <div style={{ textAlign: 'right' }}>
          {change !== 0 && (
            <span style={{
              fontSize: 12, fontWeight: 600,
              color: change < 0 ? '#16a34a' : '#dc2626',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3,
            }}>
              {change < 0 && <TrendingDown size={12} />}
              {change < 0 ? '−' : '+'}${Math.abs(change).toFixed(2)}
            </span>
          )}
          {change === 0 && <span style={{ fontSize: 12, color: '#ccc' }}>—</span>}
        </div>

        {/* Savings */}
        <div style={{ textAlign: 'right' }}>
          {sale && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>${savings.toFixed(2)}</div>
              <div style={{ fontSize: 11, color: '#bbb' }}>−{pct}%</div>
            </div>
          )}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
          {atl  && <span className="badge badge-atl">ATL</span>}
          {sale && <span className="badge badge-sale">SALE</span>}
        </div>

        {/* Expand toggle */}
        <div style={{ color: '#bbb', display: 'flex', justifyContent: 'center' }}>
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expanded chart */}
      {isExpanded && <PriceChart product={p} />}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [tab, setTab] = useState<TabKey>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const watched = useMemo(
    () => PRODUCTS.filter(p => WATCHED_IDS.includes(p.id)),
    []
  )

  const displayed = useMemo(() => {
    return watched.filter(p => {
      if (tab === 'sale') return isOnSale(p)
      if (tab === 'atl')  return isAtl(p)
      return true
    })
  }, [watched, tab])

  const dashStats = useMemo(() => {
    const onSale = watched.filter(isOnSale)
    const atls   = watched.filter(isAtl)
    const totalSaved = onSale.reduce((s, p) => s + (p.regular - p.price), 0)
    return { total: watched.length, onSale: onSale.length, atl: atls.length, saved: totalSaved }
  }, [watched])

  const toggleExpand = (id: string) =>
    setExpanded(prev => (prev === id ? null : id))

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all',  label: `All (${watched.length})` },
    { key: 'sale', label: `On Sale (${dashStats.onSale})` },
    { key: 'atl',  label: `At ATL (${dashStats.atl})` },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 60px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6, letterSpacing: '0.05em' }}>
          Good morning, Josh.
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
          My <span style={{ color: '#dc2626' }}>Watchlist</span>
        </h1>
        <p style={{ fontSize: 13, color: '#888', marginTop: 6 }}>
          Tracking {dashStats.total} products · {dashStats.onSale} on sale · {dashStats.atl} at all-time low
        </p>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 36 }}>
        <DashStat value={dashStats.total}                   label="Tracked"      accent />
        <DashStat value={dashStats.onSale}                   label="On Sale" />
        <DashStat value={dashStats.atl}                      label="At ATL" />
        <DashStat value={`$${dashStats.saved.toFixed(0)}`}   label="Total Savings" />
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #ebebeb', marginBottom: 4 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setExpanded(null) }}
            style={{
              fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? '#dc2626' : '#888',
              padding: '8px 20px',
              border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: tab === t.key ? '2px solid #dc2626' : '2px solid transparent',
              marginBottom: -2,
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Table header ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 100px 100px 88px 88px 80px 32px',
        gap: 12,
        padding: '8px 8px',
        borderBottom: '1px solid #e8e8e8',
      }}>
        {['Product', 'Trend', 'Price', '30d Change', 'Savings', 'Status', ''].map(h => (
          <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#bbb', textTransform: 'uppercase', textAlign: h === '' || h === 'Trend' ? 'center' : h === 'Product' ? 'left' : 'right' }}>
            {h}
          </div>
        ))}
      </div>

      {/* ── Rows ── */}
      <div>
        {displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#bbb' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>∅</div>
            <div style={{ fontSize: 13 }}>No items in this filter.</div>
          </div>
        ) : (
          displayed.map(p => (
            <DashRow
              key={p.id}
              product={p}
              isExpanded={expanded === p.id}
              onToggle={() => toggleExpand(p.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
