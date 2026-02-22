import { useState } from 'react'
import { ChevronRight, ChevronDown, X } from 'lucide-react'
import { PRODUCTS, CATEGORIES, discountPct, isAtl, isOnSale } from '../data/mockData'
import type { Product } from '../types'

// ─── Mosaic Tile ──────────────────────────────────────────────────────────────

function MosaicTile({ product: p, onSelect }: { product: Product; onSelect: (p: Product) => void }) {
  const sale = isOnSale(p)
  const atl = isAtl(p)
  const pct = discountPct(p)

  return (
    <div
      className="bg-white border border-gray-200 overflow-hidden cursor-pointer transition-[border-color,box-shadow] duration-150 hover:border-gray-400 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
      onClick={() => onSelect(p)}
    >
      {/* Color block */}
      <div
        className="aspect-[4/3] w-full flex items-end p-2"
        style={{ background: `hsl(${p.hue}, 22%, 44%)` }}
      >
        <div className="flex gap-1">
          {atl  && <span className="inline-flex items-center bg-sky-600 text-sky-100 text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 leading-[1.4]">ATL</span>}
          {sale && <span className="inline-flex items-center bg-red-700 text-red-100 text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 leading-[1.4]">SALE</span>}
        </div>
      </div>

      {/* Info */}
      <div className="px-[10px] pt-[10px] pb-3">
        <div className="text-xs font-semibold text-gray-900 leading-[1.3] mb-1.5 line-clamp-2">
          {p.name}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold">${p.price.toFixed(2)}</span>
          {sale && (
            <>
              <span className="text-[11px] text-gray-300 line-through">${p.regular.toFixed(2)}</span>
              <span className="text-[11px] font-bold text-red-600">−{pct}%</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Product Modal ────────────────────────────────────────────────────────────

function ProductModal({ product: p, onClose }: { product: Product; onClose: () => void }) {
  const sale = isOnSale(p)
  const atl  = isAtl(p)
  const pct  = discountPct(p)
  const savings = p.regular - p.price

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/45 z-[200] flex items-center justify-center p-6"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white max-w-[480px] w-full max-h-[90vh] overflow-auto"
      >
        {/* Color block header */}
        <div
          className="h-[180px] flex flex-col justify-between p-4"
          style={{ background: `hsl(${p.hue}, 22%, 44%)` }}
        >
          <button
            onClick={onClose}
            className="self-end bg-black/20 border-none text-white p-[4px_6px] cursor-pointer flex items-center"
          >
            <X size={14} />
          </button>
          <div className="flex gap-1.5">
            {atl  && <span className="inline-flex items-center bg-sky-600 text-sky-100 text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 leading-[1.4]">ATL</span>}
            {sale && <span className="inline-flex items-center bg-red-700 text-red-100 text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 leading-[1.4]">SALE</span>}
          </div>
        </div>

        {/* Product info */}
        <div className="p-6">
          <div className="text-[11px] font-bold tracking-[0.12em] text-gray-400 uppercase mb-1.5">
            {p.category}
          </div>
          <h2 className="text-[22px] font-[800] tracking-[-0.02em] mb-4 leading-[1.2]">
            {p.name}
          </h2>

          {/* Price grid */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label: 'Current Price', value: `$${p.price.toFixed(2)}`, highlight: true },
              { label: 'Regular Price', value: `$${p.regular.toFixed(2)}` },
              { label: 'All-Time Low',  value: `$${p.lowest.toFixed(2)}` },
            ].map(item => (
              <div key={item.label} className={`border-t-2 pt-[10px] ${item.highlight ? 'border-red-600' : 'border-gray-200'}`}>
                <div className="text-[10px] font-semibold tracking-[0.08em] text-gray-300 uppercase">
                  {item.label}
                </div>
                <div className={`text-xl font-[800] mt-1 ${item.highlight ? 'text-red-600' : 'text-gray-900'}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {sale && (
            <div className="bg-red-50 border border-red-200 px-[14px] py-[10px] flex justify-between items-center">
              <span className="text-[13px] text-red-600 font-semibold">
                You save ${savings.toFixed(2)} ({pct}% off)
              </span>
              {atl && <span className="text-[11px] font-bold text-gray-900">★ All-Time Low</span>}
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-5 w-full py-[11px] bg-gray-900 text-white border-none text-[13px] font-semibold tracking-[0.06em] cursor-pointer font-sans transition-[background] duration-150 hover:bg-red-600"
          >
            View on Uniqlo →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Category Section ─────────────────────────────────────────────────────────

function CatSection({
  name, index, isOpen, onToggle, onSelect,
}: {
  name: string
  index: number
  isOpen: boolean
  onToggle: () => void
  onSelect: (p: Product) => void
}) {
  const products = PRODUCTS.filter(p => p.category === name)
  const onSaleCount = products.filter(isOnSale).length
  const atlCount    = products.filter(isAtl).length

  return (
    <div className={`border-t-[3px] ${index === 0 ? 'border-red-600' : 'border-gray-900'}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 bg-transparent border-none cursor-pointer font-sans text-left"
      >
        <div className="flex items-baseline gap-4">
          <span className="text-[15px] font-[800] tracking-[0.1em] uppercase text-gray-900">
            {name}
          </span>
          <span className="text-xs text-gray-400">
            {products.length} products
          </span>
          {onSaleCount > 0 && (
            <span className="text-xs">
              <span className="text-red-600 font-semibold">{onSaleCount}</span>
              <span className="text-gray-400"> on sale</span>
            </span>
          )}
          {atlCount > 0 && (
            <span className="inline-flex items-center bg-sky-600 text-sky-100 text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 leading-[1.4] align-middle">
              {atlCount} ATL
            </span>
          )}
        </div>
        <div className="text-gray-300 flex items-center gap-2">
          <span className="text-xs text-gray-300">{isOpen ? 'Collapse' : 'Expand'}</span>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {/* Mosaic grid */}
      {isOpen && (
        <div className="grid grid-cols-5 gap-3 pb-7">
          {products.map(p => (
            <MosaicTile key={p.id} product={p} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [open, setOpen] = useState<Set<string>>(new Set([CATEGORIES[0]]))
  const [selected, setSelected] = useState<Product | null>(null)

  const toggle = (cat: string) => {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-[60px]">

      {/* ── Header ── */}
      <div className="mb-9">
        <h1 className="text-[36px] font-black tracking-[-0.03em] leading-none">
          Browse <span className="text-red-600">Categories</span>
        </h1>
        <p className="text-[13px] text-gray-400 mt-1.5">
          {CATEGORIES.length} categories · {PRODUCTS.length} products tracked
        </p>
      </div>

      {/* ── Category list ── */}
      <div>
        {CATEGORIES.map((cat, i) => (
          <CatSection
            key={cat}
            name={cat}
            index={i}
            isOpen={open.has(cat)}
            onToggle={() => toggle(cat)}
            onSelect={setSelected}
          />
        ))}
      </div>

      {/* ── Modal ── */}
      {selected && (
        <ProductModal product={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
