import { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { discountPct, isOnSale, isAtl } from '../data/mockData'
import type { Product, SortKey } from '../types/types'
import { getImage, getProducts } from '../data/api'
import PageLoader from '../components/PageLoader'
import ProductModal, { productHue } from '../components/ProductModal'
import { useProductModal } from '../hooks/useProductModal'

function formatLabel(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function sortProducts(products: Product[], key: SortKey): Product[] {
  return [...products].sort((a, b) => {
    switch (key) {
      case 'price': return a.price - b.price
      case 'name':  return a.name.localeCompare(b.name)
      case 'atl':   return (isAtl(a) ? 0 : 1) - (isAtl(b) ? 0 : 1)
      default:      return discountPct(b) - discountPct(a)
    }
  })
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

// ─── Product Grid ─────────────────────────────────────────────────────────────

function ProductGrid({ products, sort, onSelect }: {
  products: Product[]
  sort: SortKey
  onSelect: (id: string) => void
}) {
  const saleProducts  = sortProducts(products.filter(isOnSale), sort)
  const otherProducts = sortProducts(products.filter(p => !isOnSale(p)), sort)

  return (
    <div className="space-y-5">
      {saleProducts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {saleProducts.map(p => (
            <MosaicTile key={p.product_id} product={p} onSelect={onSelect} />
          ))}
        </div>
      )}
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
  )
}

// ─── Subcategory Section ──────────────────────────────────────────────────────

function SubcatSection({
  label,
  isOpen,
  onToggle,
  onSelect,
  products,
  sort,
}: {
  label: string
  isOpen: boolean
  onToggle: () => void
  onSelect: (id: string) => void
  products: Product[]
  sort: SortKey
}) {
  const onSaleCount = products.filter(isOnSale).length
  const atlCount    = products.filter(p => p.is_all_time_low).length

  return (
    <div className="border-t border-gray-100 dark:border-stone-800">
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_100px_88px_72px_auto] items-center gap-4 py-3 pl-7 pr-0 bg-transparent border-none cursor-pointer font-sans text-left"
      >
        <div>
          <span className="text-[13px] font-bold tracking-[0.08em] uppercase text-gray-600 dark:text-stone-400">
            {label}
          </span>
          <div className="sm:hidden text-[11px] text-gray-400 dark:text-stone-500 mt-0.5">
            {products.length} products
            {onSaleCount > 0 && <span className="text-red-600 font-semibold"> · {onSaleCount} sale</span>}
            {atlCount > 0 && <span className="text-sky-600 font-semibold"> · {atlCount} ATL</span>}
          </div>
        </div>

        <span className="hidden sm:block text-xs text-gray-400 dark:text-stone-500">
          {products.length} products
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

        <div className="text-gray-400 dark:text-stone-500 flex items-center justify-end">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {isOpen && (
        <div className="pl-7 pb-7">
          <ProductGrid products={products} sort={sort} onSelect={onSelect} />
        </div>
      )}
    </div>
  )
}

// ─── Gender Section ───────────────────────────────────────────────────────────

function GenderSection({
  genderSlug,
  index,
  isOpen,
  onToggle,
  subcategories,
  openSubcats,
  onSubcatToggle,
  onSelect,
  allProducts,
  sort,
}: {
  genderSlug: string
  index: number
  isOpen: boolean
  onToggle: () => void
  subcategories: string[]
  openSubcats: Set<string>
  onSubcatToggle: (slug: string) => void
  onSelect: (id: string) => void
  allProducts: Product[]
  sort: SortKey
}) {
  const onSaleCount = allProducts.filter(isOnSale).length
  const atlCount    = allProducts.filter(p => p.is_all_time_low).length
  const hasSubcats  = subcategories.length > 0

  return (
    <div className={`border-t-[3px] ${index === 0 ? 'border-red-600' : 'border-gray-900 dark:border-stone-100'}`}>
      {/* Gender header */}
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_100px_88px_72px_auto] items-center gap-4 py-4 bg-transparent border-none cursor-pointer font-sans text-left"
      >
        <div>
          <span className="text-[15px] font-[800] tracking-[0.1em] uppercase text-gray-900 dark:text-stone-100">
            {formatLabel(genderSlug)}
          </span>
          <div className="sm:hidden text-[11px] text-gray-400 dark:text-stone-500 mt-0.5">
            {allProducts.length} products
            {onSaleCount > 0 && <span className="text-red-600 font-semibold"> · {onSaleCount} sale</span>}
            {atlCount > 0 && <span className="text-sky-600 font-semibold"> · {atlCount} ATL</span>}
          </div>
        </div>

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

        <div className="text-gray-300 dark:text-stone-600 flex items-center gap-2 justify-end">
          <span className="text-xs">{isOpen ? 'Collapse' : 'Expand'}</span>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {/* Subcategories or direct product grid */}
      {isOpen && (
        hasSubcats ? (
          <div className="pb-4">
            {subcategories.map(sub => {
              const fullSlug   = `${genderSlug}/${sub}`
              const subProducts = allProducts.filter(p => p.categories.includes(fullSlug))
              if (subProducts.length === 0) return null
              return (
                <SubcatSection
                  key={fullSlug}
                  label={formatLabel(sub)}
                  isOpen={openSubcats.has(fullSlug)}
                  onToggle={() => onSubcatToggle(fullSlug)}
                  onSelect={onSelect}
                  products={subProducts}
                  sort={sort}
                />
              )
            })}
          </div>
        ) : (
          <div className="pb-7">
            <ProductGrid products={allProducts} sort={sort} onSelect={onSelect} />
          </div>
        )
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'discount', label: 'Most Discounted' },
  { key: 'price',    label: 'Price: Low → High' },
  { key: 'name',     label: 'Name: A → Z' },
  { key: 'atl',      label: 'At All-Time Low' },
]

export default function CategoriesPage() {
  const [openGenders, setOpenGenders] = useState<Set<string>>(new Set())
  const [openSubcats, setOpenSubcats] = useState<Set<string>>(new Set())
  const [sort, setSort]     = useState<SortKey>('discount')
  const [search, setSearch] = useState('')
  const deferredSearch      = useDeferredValue(search)
  const [searchParams]      = useSearchParams()

  const { data: productsAPI, isLoading } = getProducts()
  const { modalId, openModal, closeModal } = useProductModal()

  const products: Product[] = productsAPI?.products ?? []
  const selectedProduct     = products.find(p => p.product_id === modalId) ?? null

  // Auto-expand category from ?open= URL param (e.g. from "View category →" on home page)
  useEffect(() => {
    const open = searchParams.get('open')
    if (!open) return
    const slashIdx = open.indexOf('/')
    if (slashIdx !== -1) {
      const gender = open.slice(0, slashIdx)
      setOpenGenders(new Set([gender]))
      setOpenSubcats(new Set([open]))
    } else {
      setOpenGenders(new Set([open]))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter by search — uses deferred value so the input stays snappy
  // while the expensive expansion/render is scheduled at lower priority.
  const visibleProducts = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase()
    if (!term) return products
    return products.filter(p =>
      p.name.toLowerCase().includes(term) || p.product_id.includes(term)
    )
  }, [products, deferredSearch])

  // Build gender → subcategories tree from ALL categories (not just visible)
  const allCategorySlugs = useMemo(
    () => Array.from(new Set(products.flatMap(p => p.categories))).sort(),
    [products]
  )

  const genderTree = useMemo(() => {
    const tree = new Map<string, string[]>()
    for (const cat of allCategorySlugs) {
      const slashIndex = cat.indexOf('/')
      if (slashIndex === -1) {
        if (!tree.has(cat)) tree.set(cat, [])
      } else {
        const gender = cat.slice(0, slashIndex)
        const subcat = cat.slice(slashIndex + 1)
        if (!tree.has(gender)) tree.set(gender, [])
        tree.get(gender)!.push(subcat)
      }
    }
    return tree
  }, [allCategorySlugs])

  const genders = Array.from(genderTree.keys())

  const toggleGender = (gender: string) => {
    setOpenGenders(prev => {
      const next = new Set(prev)
      if (next.has(gender)) next.delete(gender); else next.add(gender)
      return next
    })
  }

  const toggleSubcat = (slug: string) => {
    setOpenSubcats(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug); else next.add(slug)
      return next
    })
  }

  // When searching, auto-expand every gender/subcat that has matching products.
  // When search is cleared, revert to the manually toggled state.
  const isSearching = deferredSearch.trim().length > 0
  const isPending   = search !== deferredSearch

  const effectiveOpenGenders: Set<string> = isSearching
    ? new Set(genders.filter(g =>
        visibleProducts.some(p => p.categories.some(c => c === g || c.startsWith(`${g}/`)))
      ))
    : openGenders

  const effectiveOpenSubcats: Set<string> = isSearching
    ? new Set(allCategorySlugs.filter(slug =>
        visibleProducts.some(p => p.categories.includes(slug))
      ))
    : openSubcats

  if (isLoading) return <PageLoader />

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-10 pb-[60px]">

      {/* ── Header ── */}
      <div className="mb-7">
        <h1 className="text-[26px] sm:text-[36px] font-black tracking-[-0.03em] leading-none">
          Browse <span className="text-red-600">Categories</span>
        </h1>
        <p className="text-[13px] text-gray-400 dark:text-stone-500 mt-1.5">
          {allCategorySlugs.length} categories · {products.length} products tracked
        </p>
      </div>

      {/* ── Search + Sort toolbar ── */}
      <div className="flex flex-col gap-3 mb-9 pb-7 border-b border-stone-200 dark:border-stone-700">
        {/* Search */}
        <input
          type="text"
          placeholder="Search all products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-transparent border-0 border-b-2 border-gray-300 dark:border-stone-600 focus:border-sky-700 dark:focus:border-sky-500 outline-none px-0 py-1 text-base w-full sm:w-[320px] font-normal text-gray-900 dark:text-stone-100 transition-[border-color] duration-150 placeholder:italic placeholder:text-gray-400 dark:placeholder:text-stone-500 font-sans"
        />
        {/* Sort */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold tracking-[0.15em] text-gray-400 dark:text-stone-500 uppercase shrink-0">
            Sort
          </span>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
              className={`text-[11px] font-semibold px-2.5 py-1 border transition-colors font-sans cursor-pointer ${
                sort === opt.key
                  ? 'bg-gray-900 dark:bg-stone-100 text-white dark:text-stone-900 border-gray-900 dark:border-stone-100'
                  : 'bg-transparent text-gray-500 dark:text-stone-400 border-gray-300 dark:border-stone-600 hover:border-gray-400 dark:hover:border-stone-500 hover:text-gray-700 dark:hover:text-stone-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Gender groups ── */}
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-50' : 'opacity-100'}`}>
        {genders.map((gender, i) => {
          const subcategories  = genderTree.get(gender)!
          const genderProducts = visibleProducts.filter(p =>
            p.categories.some(c => c === gender || c.startsWith(`${gender}/`))
          )
          if (genderProducts.length === 0 && isSearching) return null
          return (
            <GenderSection
              key={gender}
              genderSlug={gender}
              index={i}
              isOpen={effectiveOpenGenders.has(gender)}
              onToggle={() => toggleGender(gender)}
              subcategories={subcategories}
              openSubcats={effectiveOpenSubcats}
              onSubcatToggle={toggleSubcat}
              onSelect={openModal}
              allProducts={genderProducts}
              sort={sort}
            />
          )
        })}
        {isSearching && genders.every(g => {
          const gp = visibleProducts.filter(p => p.categories.some(c => c === g || c.startsWith(`${g}/`)))
          return gp.length === 0
        }) && (
          <div className="text-center py-[60px] text-gray-400 dark:text-stone-500">
            <div className="text-[32px] mb-3">∅</div>
            <div className="text-sm">No products match your search.</div>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={closeModal} />
      )}
    </div>
  )
}
