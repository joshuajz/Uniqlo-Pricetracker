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
    <div className={`border-t-[3px] pt-3 ${accent ? 'border-red-600' : 'border-gray-900'}`}>
      <div className="text-[22px] sm:text-[28px] font-black tracking-[-0.03em]">{value}</div>
      <div className="text-[11px] font-semibold tracking-[0.1em] text-gray-400 uppercase mt-[3px]">
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
    <div className="px-1 sm:px-0 sm:pr-4 pt-5 pb-5 border-t border-gray-100">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_280px] gap-4 sm:gap-6">
        {/* Chart */}
        <div>
          <div className="text-[11px] font-bold tracking-[0.1em] text-gray-400 uppercase mb-3">
            Price History (10 months)
          </div>
          <ResponsiveContainer width="100%" height={160}>
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
          <div className="text-[11px] font-bold tracking-[0.1em] text-gray-400 uppercase mb-3">
            Price Log
          </div>
          <div className="flex flex-col">
            {[...chartData].reverse().map((row, i) => {
              const isLatest = i === 0
              return (
                <div
                  key={row.date}
                  className={`flex justify-between items-center py-[5px] border-b border-neutral-100 text-xs ${isLatest ? 'bg-red-50 px-1.5' : ''}`}
                >
                  <span className={isLatest ? 'text-gray-900 font-semibold' : 'text-gray-400'}>
                    {row.date}
                  </span>
                  <span className={isLatest ? 'font-bold text-red-600' : 'font-normal text-gray-900'}>
                    ${row.price.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Quick stats */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: 'Current', value: `$${product.price.toFixed(2)}` },
              { label: 'Regular', value: `$${product.regular_price.toFixed(2)}` },
              { label: 'All-Time Low', value: `$${product.lowest.toFixed(2)}` },
              { label: '30d Change', value: change <= 0 ? `−$${Math.abs(change).toFixed(2)}` : `+$${change.toFixed(2)}`, red: change < 0 },
            ].map(s => (
              <div key={s.label}>
                <div className="text-[10px] font-semibold tracking-[0.08em] text-gray-300 uppercase">
                  {s.label}
                </div>
                <div className={`text-sm font-bold mt-0.5 ${'red' in s && s.red ? 'text-red-600' : 'text-gray-900'}`}>
                  {s.value}
                </div>
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
  const savings = p.regular_price - p.price

  const change = history.length >= 2
    ? history[history.length - 1] - history[history.length - 2]
    : 0

  return (
    <div className="border-b border-gray-100 group">

      {/* ── Mobile layout ── */}
      <div
        onClick={onToggle}
        className="sm:hidden flex items-center gap-3 px-1 py-3 cursor-pointer transition-colors hover:bg-stone-100"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-medium leading-snug flex-1 min-w-0">{p.name}</div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold">${p.price.toFixed(2)}</div>
              {sale && <div className="text-xs font-bold text-emerald-600">−{pct}%</div>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="inline-flex items-center bg-stone-100 text-gray-500 text-[10px] font-semibold tracking-[0.08em] px-[5px] py-[1px] leading-[1.4]">
              {p.category.toUpperCase()}
            </span>
            <span className="text-[11px] text-gray-300">{genderLabel(p.gender)}</span>
            {sale && <span className="text-[11px] text-green-600 font-semibold">Save ${savings.toFixed(2)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col gap-[3px]">
            <span className={`inline-flex items-center justify-center w-10 bg-sky-600 text-sky-100 text-[10px] font-bold tracking-[0.06em] py-0.5 leading-[1.4] ${atl ? '' : 'invisible'}`}>ATL</span>
            <span className={`inline-flex items-center justify-center w-10 bg-red-700 text-red-100 text-[10px] font-bold tracking-[0.06em] py-0.5 leading-[1.4] ${sale ? '' : 'invisible'}`}>SALE</span>
          </div>
          <div className="text-gray-300">
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </div>

      {/* ── Desktop layout ── */}
      <div
        onClick={onToggle}
        className="hidden sm:grid grid-cols-[1fr_100px_100px_88px_88px_80px_32px] items-center gap-3 px-2 py-3 cursor-pointer transition-colors group-hover:bg-stone-100 -mx-2"
      >
        {/* Name + category */}
        <div>
          <div className="text-sm font-medium">{p.name}</div>
          <div className="flex gap-1.5 mt-[3px] items-center">
            <span className="inline-flex items-center bg-stone-100 text-gray-500 text-[10px] font-semibold tracking-[0.08em] px-[5px] py-[1px] leading-[1.4]">
              {p.category.toUpperCase()}
            </span>
            <span className="text-[11px] text-gray-300">{genderLabel(p.gender)}</span>
          </div>
        </div>

        {/* Sparkline */}
        <div className="flex justify-center">
          <PriceSparkline prices={history} width={80} height={28} />
        </div>

        {/* Current price */}
        <div className="text-right">
          <div className="text-[15px] font-bold">${p.price.toFixed(2)}</div>
          <div className="text-[11px] text-gray-300 line-through mt-[1px]">${p.regular_price.toFixed(2)}</div>
        </div>

        {/* Change */}
        <div className="text-right">
          {change !== 0 && (
            <span className={`text-xs font-semibold flex items-center justify-end gap-[3px] ${change < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change < 0 && <TrendingDown size={12} />}
              {change < 0 ? '−' : '+'}${Math.abs(change).toFixed(2)}
            </span>
          )}
          {change === 0 && <span className="text-xs text-gray-300">—</span>}
        </div>

        {/* Savings */}
        <div className="text-right">
          {sale && (
            <div>
              <div className="text-[13px] font-bold text-green-600">${savings.toFixed(2)}</div>
              <div className="text-[11px] text-gray-300">−{pct}%</div>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-col gap-[3px] items-end">
          <span className={`inline-flex items-center justify-center w-10 bg-sky-600 text-sky-100 text-[10px] font-bold tracking-[0.06em] py-0.5 leading-[1.4] ${atl ? '' : 'invisible'}`}>ATL</span>
          <span className={`inline-flex items-center justify-center w-10 bg-red-700 text-red-100 text-[10px] font-bold tracking-[0.06em] py-0.5 leading-[1.4] ${sale ? '' : 'invisible'}`}>SALE</span>
        </div>

        {/* Expand toggle */}
        <div className="text-gray-300 flex justify-center">
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
    const totalSaved = onSale.reduce((s, p) => s + (p.regular_price - p.price), 0)
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
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-10 pb-[60px]">

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="text-xs text-gray-400 mb-1.5 tracking-[0.05em]">
          Good morning, Josh.
        </div>
        <h1 className="text-[30px] sm:text-[36px] font-black tracking-[-0.03em] leading-none">
          My <span className="text-red-600">Watchlist</span>
        </h1>
        <p className="text-[13px] text-gray-400 mt-1.5">
          Tracking {dashStats.total} products · {dashStats.onSale} on sale · {dashStats.atl} at all-time low
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-9">
        <DashStat value={dashStats.total}                   label="Tracked"      accent />
        <DashStat value={dashStats.onSale}                   label="On Sale" />
        <DashStat value={dashStats.atl}                      label="At ATL" />
        <DashStat value={`$${dashStats.saved.toFixed(0)}`}   label="Total Savings" />
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b-2 border-gray-200 mb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setExpanded(null) }}
            className={`text-[13px] px-4 sm:px-5 py-2 border-none bg-transparent cursor-pointer font-sans border-b-2 -mb-0.5 transition-all ${
              tab === t.key
                ? 'font-semibold text-red-600 border-red-600'
                : 'font-normal text-gray-400 border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Table header — desktop only ── */}
      <div className="hidden sm:grid grid-cols-[1fr_100px_100px_88px_88px_80px_32px] gap-3 px-2 py-2 border-b border-gray-200">
        {['Product', 'Trend', 'Price', '30d Change', 'Savings', 'Status', ''].map(h => (
          <div
            key={h}
            className={`text-[10px] font-bold tracking-[0.1em] text-gray-300 uppercase ${
              h === '' || h === 'Trend' ? 'text-center' : h === 'Product' ? 'text-left' : 'text-right'
            }`}
          >
            {h}
          </div>
        ))}
      </div>

      {/* ── Rows ── */}
      <div>
        {displayed.length === 0 ? (
          <div className="text-center py-12 text-gray-300">
            <div className="text-2xl mb-2">∅</div>
            <div className="text-[13px]">No items in this filter.</div>
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
