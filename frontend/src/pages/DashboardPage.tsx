import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, TrendingDown } from 'lucide-react'
import { discountPct, isAtl, isOnSale, genderLabel } from '../data/mockData'
import type { Product, TabKey } from '../types/types'
import { getProducts } from '../data/api'
import PageLoader from '../components/PageLoader'
import ProductModal from '../components/ProductModal'
import { useProductModal } from '../hooks/useProductModal'

// ─── Stat Card ───────────────────────────────────────────────────────────────

function DashStat({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className={`border-t-[3px] pt-3 ${accent ? 'border-red-600' : 'border-gray-900 dark:border-stone-100'}`}>
      <div className="text-[22px] sm:text-[28px] font-black tracking-[-0.03em]">{value}</div>
      <div className="text-[11px] font-semibold tracking-[0.1em] text-gray-400 dark:text-stone-500 uppercase mt-[3px]">
        {label}
      </div>
    </div>
  )
}

// ─── Dashboard Row ────────────────────────────────────────────────────────────

function DashRow({ product: p, onSelect }: { product: Product; onSelect: (id: string) => void }) {
  const pct = discountPct(p)
  const atl = isAtl(p)
  const sale = isOnSale(p)
  const savings = p.regular_price - p.price
  const categoryLabel = p.categories[0] ?? ''

  return (
    <div className="border-b border-gray-100 dark:border-stone-800 group cursor-pointer" onClick={() => onSelect(p.product_id)}>

      {/* ── Mobile layout ── */}
      <div className="sm:hidden flex items-center gap-3 px-1 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-medium leading-snug flex-1 min-w-0">{p.name}</div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold">${p.price.toFixed(2)}</div>
              {sale && <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">−{pct}%</div>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="inline-flex items-center bg-stone-100 dark:bg-stone-800 text-gray-500 dark:text-stone-400 text-[10px] font-semibold tracking-[0.08em] px-[5px] py-[1px] leading-[1.4]">
              {categoryLabel.toUpperCase()}
            </span>
            {p.gender && <span className="text-[11px] text-gray-300 dark:text-stone-600">{genderLabel(p.gender)}</span>}
            {sale && <span className="text-[11px] text-green-600 dark:text-emerald-400 font-semibold">Save ${savings.toFixed(2)}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-[3px] shrink-0">
          <span className={`inline-flex items-center justify-center w-10 bg-sky-600 text-sky-100 text-[10px] font-bold tracking-[0.06em] py-0.5 leading-[1.4] ${atl ? '' : 'invisible'}`}>ATL</span>
          <span className={`inline-flex items-center justify-center w-10 bg-red-700 text-red-100 text-[10px] font-bold tracking-[0.06em] py-0.5 leading-[1.4] ${sale ? '' : 'invisible'}`}>SALE</span>
        </div>
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden sm:grid grid-cols-[1fr_120px_100px_88px_80px] items-center gap-3 px-2 py-3 -mx-2 group-hover:bg-stone-100 dark:group-hover:bg-stone-800">
        {/* Name + category */}
        <div>
          <div className="text-sm font-medium">{p.name}</div>
          <div className="flex gap-1.5 mt-[3px] items-center">
            <span className="inline-flex items-center bg-stone-100 dark:bg-stone-800 text-gray-500 dark:text-stone-400 text-[10px] font-semibold tracking-[0.08em] px-[5px] py-[1px] leading-[1.4]">
              {categoryLabel.toUpperCase()}
            </span>
            {p.gender && <span className="text-[11px] text-gray-300 dark:text-stone-600">{genderLabel(p.gender)}</span>}
          </div>
        </div>

        {/* Current price */}
        <div className="text-right">
          <div className="text-[15px] font-bold">${p.price.toFixed(2)}</div>
          <div className="text-[11px] text-gray-300 dark:text-stone-600 line-through mt-[1px]">${p.regular_price.toFixed(2)}</div>
        </div>

        {/* Savings */}
        <div className="text-right">
          {sale && (
            <div>
              <div className="text-[13px] font-bold text-green-600 dark:text-emerald-400">${savings.toFixed(2)}</div>
              <div className="text-[11px] text-gray-300 dark:text-stone-600">−{pct}%</div>
            </div>
          )}
        </div>

        {/* ATL price */}
        <div className="text-right">
          <div className="text-[13px] font-semibold text-gray-900 dark:text-stone-100">${p.lowest_price.toFixed(2)}</div>
          <div className="text-[11px] text-gray-300 dark:text-stone-600">all-time low</div>
        </div>

        {/* Badges */}
        <div className="flex flex-col gap-[3px] items-end">
          <span className={`inline-flex items-center justify-center w-10 bg-sky-600 text-sky-100 text-[10px] font-bold tracking-[0.06em] py-0.5 leading-[1.4] ${atl ? '' : 'invisible'}`}>ATL</span>
          <span className={`inline-flex items-center justify-center w-10 bg-red-700 text-red-100 text-[10px] font-bold tracking-[0.06em] py-0.5 leading-[1.4] ${sale ? '' : 'invisible'}`}>SALE</span>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [tab, setTab] = useState<TabKey>('all')
  const { data: productsAPI, isLoading } = getProducts()
  const products: Product[] = productsAPI?.products ?? []
  const { modalId, openModal, closeModal } = useProductModal()
  const selectedProduct = products.find(p => p.product_id === modalId) ?? null

  const onSale = useMemo(() => products.filter(isOnSale), [products])
  const atls   = useMemo(() => products.filter(isAtl),    [products])

  const displayed = useMemo(() => {
    if (tab === 'sale') return onSale
    if (tab === 'atl')  return atls
    return onSale
  }, [tab, onSale, atls])

  const totalSaved = useMemo(
    () => onSale.reduce((s, p) => s + (p.regular_price - p.price), 0),
    [onSale]
  )

  const avgDiscount = useMemo(() => {
    if (!onSale.length) return 0
    return onSale.reduce((s, p) => s + discountPct(p), 0) / onSale.length
  }, [onSale])

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all',  label: `On Sale (${onSale.length})` },
    { key: 'atl',  label: `At ATL (${atls.length})` },
  ]

  if (isLoading) return <PageLoader />

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-10 pb-[60px]">

      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-[30px] sm:text-[36px] font-black tracking-[-0.03em] leading-none">
          Sale <span className="text-red-600">Dashboard</span>
        </h1>
        <p className="text-[13px] text-gray-400 dark:text-stone-500 mt-1.5">
          {products.length} products tracked · {onSale.length} on sale · {atls.length} at all-time low
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-9">
        <DashStat value={products.length}              label="Tracked"       accent />
        <DashStat value={onSale.length}                label="On Sale" />
        <DashStat value={atls.length}                  label="At ATL" />
        <DashStat value={`$${totalSaved.toFixed(0)}`}  label="Total Savings" />
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b-2 border-gray-200 dark:border-stone-700 mb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-[13px] px-4 sm:px-5 py-2 border-none bg-transparent cursor-pointer font-sans border-b-2 -mb-0.5 transition-all ${
              tab === t.key
                ? 'font-semibold text-red-600 border-red-600'
                : 'font-normal text-gray-400 dark:text-stone-500 border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Table header — desktop only ── */}
      <div className="hidden sm:grid grid-cols-[1fr_120px_100px_88px_80px] gap-3 px-2 py-2 border-b border-gray-200 dark:border-stone-700">
        {['Product', 'Price', 'Savings', 'ATL', 'Status'].map(h => (
          <div
            key={h}
            className={`text-[10px] font-bold tracking-[0.1em] text-gray-300 dark:text-stone-600 uppercase ${
              h === 'Product' ? 'text-left' : 'text-right'
            }`}
          >
            {h}
          </div>
        ))}
      </div>

      {/* ── Rows ── */}
      <div>
        {displayed.length === 0 ? (
          <div className="text-center py-12 text-gray-300 dark:text-stone-600">
            <div className="text-2xl mb-2">∅</div>
            <div className="text-[13px]">No items in this filter.</div>
          </div>
        ) : (
          displayed.map(p => (
            <DashRow key={p.product_id} product={p} onSelect={openModal} />
          ))
        )}
      </div>

      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={closeModal} />
      )}
    </div>
  )
}
