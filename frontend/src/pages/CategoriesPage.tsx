import { useState, useEffect, useRef } from 'react'
import { ChevronRight, ChevronDown, X } from 'lucide-react'
import { PRODUCTS, discountPct, isOnSale } from '../data/mockData'
import type { Product } from '../types/types'
import { getCategories, getImage, getProducts } from '../data/api'

function productHue(id: string): number {
  return id.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0) % 360
}

function formatCatName(slug: string): string {
  return slug.split('/').map(s => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(' › ')
}

// ─── Mosaic Tile ──────────────────────────────────────────────────────────────

function MosaicTile({ product: p, onSelect }: { product: Product; onSelect: (p: Product) => void }) {
  const sale = isOnSale(p)
  const atl = p.is_all_time_low
  const pct = discountPct(p)
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const { data: imgSrc } = getImage(p.product_id, { enabled: inView })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true)
        observer.disconnect()
      }
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="bg-white border border-gray-200 overflow-hidden cursor-pointer transition-[border-color,box-shadow] duration-150 hover:border-gray-400 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
      onClick={() => onSelect(p)}
    >
      {/* Image / placeholder */}
      <div className="aspect-[4/3] w-full relative flex items-end p-2 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, hsl(${productHue(p.product_id)}, 28%, 36%), hsl(${productHue(p.product_id) + 20}, 22%, 54%))` }}
        />
        {imgSrc && (
          <img
            src={imgSrc}
            alt={p.name}
            className="absolute inset-0 w-full h-full object-contain bg-stone-100"
          />
        )}
        <div className="relative flex gap-1">
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
              <span className="text-[11px] text-gray-300 line-through">${p.regular_price.toFixed(2)}</span>
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
  const atl  = p.is_all_time_low
  const pct  = discountPct(p)
  const savings = p.regular_price - p.price

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/45 z-[200] flex items-center justify-center p-3 sm:p-6"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white max-w-[480px] w-full max-h-[90vh] overflow-auto"
      >
        {/* Color block header */}
        <div
          className="h-[140px] sm:h-[180px] flex flex-col justify-between p-4"
          style={{ background: `linear-gradient(160deg, hsl(${productHue(p.product_id)}, 28%, 36%), hsl(${productHue(p.product_id) + 20}, 22%, 54%))` }}
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
        <div className="p-4 sm:p-6">
          <div className="text-[11px] font-bold tracking-[0.12em] text-gray-400 uppercase mb-1.5">
            {p.categories.join(' / ')}
          </div>
          <h2 className="text-[18px] sm:text-[22px] font-[800] tracking-[-0.02em] mb-4 leading-[1.2]">
            {p.name}
          </h2>

          {/* Price grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
            {[
              { label: 'Current Price', value: `$${p.price.toFixed(2)}`, highlight: true },
              { label: 'Regular Price', value: `$${p.regular_price.toFixed(2)}` },
              { label: 'All-Time Low',  value: `$${p.lowest_price.toFixed(2)}` },
            ].map(item => (
              <div key={item.label} className={`border-t-2 pt-[10px] ${item.highlight ? 'border-red-600' : 'border-gray-200'}`}>
                <div className="text-[10px] font-semibold tracking-[0.08em] text-gray-300 uppercase">
                  {item.label}
                </div>
                <div className={`text-base sm:text-xl font-[800] mt-1 ${item.highlight ? 'text-red-600' : 'text-gray-900'}`}>
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
              {atl && <span className="text-[11px] font-bold text-gray-900">★ ATL</span>}
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
  const { data: productsAPI = [], isLoading: productsLoading } = getProducts()
  const { data: categoriesAPI = [], isLoading: categoriesLoading } = getCategories()

  const products: Product[] = productsAPI?.products ?? []
  const allProducts = products.filter((p: Product) => p.categories.includes(name))
  const saleProducts = allProducts.filter(isOnSale)
  const otherProducts = allProducts.filter((p: Product) => !isOnSale(p))
  const onSaleCount = saleProducts.length
  const atlCount    = allProducts.filter((p: Product) => p.is_all_time_low).length

  if (productsLoading || categoriesLoading) return <>Loading</>

  return (
    <div className={`border-t-[3px] ${index === 0 ? 'border-red-600' : 'border-gray-900'}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_100px_88px_72px_auto] items-center gap-4 py-4 bg-transparent border-none cursor-pointer font-sans text-left"
      >
        {/* Name — on mobile shows summary stats inline */}
        <div>
          <span className="text-[15px] font-[800] tracking-[0.1em] uppercase text-gray-900">
            {formatCatName(name)}
          </span>
          <div className="sm:hidden text-[11px] text-gray-400 mt-0.5">
            {allProducts.length} products
            {onSaleCount > 0 && <span className="text-red-600 font-semibold"> · {onSaleCount} sale</span>}
            {atlCount > 0 && <span className="text-sky-600 font-semibold"> · {atlCount} ATL</span>}
          </div>
        </div>

        {/* Desktop-only columns */}
        <span className="hidden sm:block text-xs text-gray-400">
          {allProducts.length} products
        </span>
        <div className="hidden sm:block">
          {onSaleCount > 0 && (
            <span className="inline-flex items-center bg-red-700 text-red-100 text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 leading-[1.4]">
              {onSaleCount} SALE
            </span>
          )}
        </div>
        <div className="hidden sm:block">
          {atlCount > 0 && (
            <span className="inline-flex items-center bg-sky-600 text-sky-100 text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 leading-[1.4]">
              {atlCount} ATL
            </span>
          )}
        </div>

        {/* Expand/collapse — always visible */}
        <div className="text-gray-300 flex items-center gap-2 justify-end">
          <span className="text-xs">{isOpen ? 'Collapse' : 'Expand'}</span>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {/* Mosaic grid */}
      {isOpen && (
        <div className="pb-7 space-y-5">
          {/* On-sale items */}
          {saleProducts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {saleProducts.map(p => (
                <MosaicTile key={p.product_id} product={p} onSelect={onSelect} />
              ))}
            </div>
          )}

          {/* Non-sale items */}
          {otherProducts.length > 0 && (
            <div>
              {saleProducts.length > 0 && (
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-gray-400">
                    Regular Price
                  </span>
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {otherProducts.map(p => (
                  <MosaicTile key={p.product_id} product={p} onSelect={onSelect} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = Array.from(
  new Set(PRODUCTS.products.flatMap(p => p.categories))
).sort()

export default function CategoriesPage() {
  const [open, setOpen] = useState<Set<string>>(new Set())
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
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-10 pb-[60px]">

      {/* ── Header ── */}
      <div className="mb-9">
        <h1 className="text-[26px] sm:text-[36px] font-black tracking-[-0.03em] leading-none">
          Browse <span className="text-red-600">Categories</span>
        </h1>
        <p className="text-[13px] text-gray-400 mt-1.5">
          {ALL_CATEGORIES.length} categories · {PRODUCTS.products.length} products tracked
        </p>
      </div>

      {/* ── Category list ── */}
      <div>
        {ALL_CATEGORIES.map((cat, i) => (
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
