import { useState, useEffect, useRef } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { discountPct, isOnSale } from '../data/mockData'
import type { Product } from '../types/types'
import { getImage, getProducts } from '../data/api'
import PageLoader from '../components/PageLoader'
import ProductModal, { productHue } from '../components/ProductModal'
import { useProductModal } from '../hooks/useProductModal'

function formatCatName(slug: string): string {
  return slug.split('/').map(s => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(' › ')
}

// ─── Mosaic Tile ──────────────────────────────────────────────────────────────

function MosaicTile({ product: p, onSelect }: { product: Product; onSelect: (id: string) => void }) {
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
      className="bg-white dark:bg-stone-900 border border-gray-200 dark:border-stone-700 overflow-hidden cursor-pointer transition-[border-color,box-shadow] duration-150 hover:border-gray-400 dark:hover:border-stone-500 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
      onClick={() => onSelect(p.product_id)}
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
            className="absolute inset-0 w-full h-full object-contain bg-stone-100 dark:bg-stone-800"
          />
        )}
        <div className="relative flex gap-1">
          {atl  && <span className="inline-flex items-center bg-sky-600 text-sky-100 text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 leading-[1.4]">ATL</span>}
          {sale && <span className="inline-flex items-center bg-red-700 text-red-100 text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 leading-[1.4]">SALE</span>}
        </div>
      </div>

      {/* Info */}
      <div className="px-[10px] pt-[10px] pb-3">
        <div className="text-xs font-semibold text-gray-900 dark:text-stone-100 leading-[1.3] mb-1.5 line-clamp-2">
          {p.name}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold">${p.price.toFixed(2)}</span>
          {sale && (
            <>
              <span className="text-[11px] text-gray-300 dark:text-stone-600 line-through">${p.regular_price.toFixed(2)}</span>
              <span className="text-[11px] font-bold text-red-600">−{pct}%</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Category Section ─────────────────────────────────────────────────────────

function CatSection({
  name, index, isOpen, onToggle, onSelect, allProducts,
}: {
  name: string
  index: number
  isOpen: boolean
  onToggle: () => void
  onSelect: (id: string) => void
  allProducts: Product[]
}) {
  const saleProducts = allProducts.filter(isOnSale)
  const otherProducts = allProducts.filter((p: Product) => !isOnSale(p))
  const onSaleCount = saleProducts.length
  const atlCount    = allProducts.filter((p: Product) => p.is_all_time_low).length

  return (
    <div className={`border-t-[3px] ${index === 0 ? 'border-red-600' : 'border-gray-900 dark:border-stone-100'}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_100px_88px_72px_auto] items-center gap-4 py-4 bg-transparent border-none cursor-pointer font-sans text-left"
      >
        {/* Name — on mobile shows summary stats inline */}
        <div>
          <span className="text-[15px] font-[800] tracking-[0.1em] uppercase text-gray-900 dark:text-stone-100">
            {formatCatName(name)}
          </span>
          <div className="sm:hidden text-[11px] text-gray-400 dark:text-stone-500 mt-0.5">
            {allProducts.length} products
            {onSaleCount > 0 && <span className="text-red-600 font-semibold"> · {onSaleCount} sale</span>}
            {atlCount > 0 && <span className="text-sky-600 font-semibold"> · {atlCount} ATL</span>}
          </div>
        </div>

        {/* Desktop-only columns */}
        <span className="hidden sm:block text-xs text-gray-400 dark:text-stone-500">
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
        <div className="text-gray-300 dark:text-stone-600 flex items-center gap-2 justify-end">
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
                  <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-gray-400 dark:text-stone-500">
                    Regular Price
                  </span>
                  <div className="flex-1 border-t border-dashed border-gray-200 dark:border-stone-700" />
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

export default function CategoriesPage() {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const { data: productsAPI, isLoading } = getProducts()
  const { modalId, openModal, closeModal } = useProductModal()

  const products: Product[] = productsAPI?.products ?? []
  const categories = Array.from(new Set(products.flatMap(p => p.categories))).sort()
  const selectedProduct = products.find(p => p.product_id === modalId) ?? null

  const toggle = (cat: string) => {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-10 pb-[60px]">

      {/* ── Header ── */}
      <div className="mb-9">
        <h1 className="text-[26px] sm:text-[36px] font-black tracking-[-0.03em] leading-none">
          Browse <span className="text-red-600">Categories</span>
        </h1>
        <p className="text-[13px] text-gray-400 dark:text-stone-500 mt-1.5">
          {categories.length} categories · {products.length} products tracked
        </p>
      </div>

      {/* ── Category list ── */}
      <div>
        {categories.map((cat, i) => (
          <CatSection
            key={cat}
            name={cat}
            index={i}
            isOpen={open.has(cat)}
            onToggle={() => toggle(cat)}
            onSelect={openModal}
            allProducts={products.filter(p => p.categories.includes(cat))}
          />
        ))}
      </div>

      {/* ── Modal ── */}
      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={closeModal} />
      )}
    </div>
  )
}
