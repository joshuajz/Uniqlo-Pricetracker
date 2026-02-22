import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  PRODUCTS, CATEGORIES, discountPct, isAtl, isOnSale, genderLabel,
} from '../data/mockData'
import type { Product, SortKey } from '../types'
import { getProducts } from '../data/api'

// ─── Helpers ────────────────────────────────────────────────────────────────

function sortProducts(products: Product[], key: SortKey): Product[] {
  return [...products].sort((a, b) => {
    switch (key) {
      case 'price': return a.price - b.price
      case 'name': return a.name.localeCompare(b.name)
      case 'atl': return (isAtl(a) ? 0 : 1) - (isAtl(b) ? 0 : 1)
      default: return discountPct(b) - discountPct(a)
    }
  })
}

// ─── Product Row ─────────────────────────────────────────────────────────────

function ProductRow({ product }: { product: Product }) {
  const pct = discountPct(product)
  const atl = isAtl(product)

  return (
    <div className="grid grid-cols-[60px_1fr_auto_auto_96px_52px] items-center gap-3 px-2 py-2 border-b border-stone-200 cursor-pointer -mx-2 transition-[background] duration-100 hover:bg-stone-100 group">
      <div className="w-[60px] h-[60px] overflow-hidden shrink-0">
        <div
          className="w-full h-full transition-transform duration-300 group-hover:scale-[1.08]"
          style={{ background: `linear-gradient(160deg, hsl(${product.hue}, 28%, 36%), hsl(${product.hue + 20}, 22%, 54%))` }}
        />
      </div>

      <div>
        <div className="text-sm font-medium text-gray-900">{product.name}</div>
        <div className="text-stone-600 text-xs mt-0.5">{genderLabel(product.gender)}</div>
      </div>

      <div>
        {atl && <span className="inline-flex items-center bg-sky-600 px-1.5 py-0.5 text-xs font-medium text-sky-100">ATL</span>}
      </div>

      <div>
        <span className="inline-flex items-center bg-red-700 px-1.5 py-0.5 text-xs font-medium text-red-100">SALE</span>
      </div>

      <div className="text-right">
        <div className="text-base font-semibold">${product.price.toFixed(2)}</div>
        <div className="text-xs text-gray-400 line-through font-light">
          ${product.regular.toFixed(2)}
        </div>
      </div>

      <div className="text-right">
        <span className="text-sm font-bold text-emerald-600">
          −{pct}%
        </span>
      </div>
    </div>
  )
}

// ─── Category Section ────────────────────────────────────────────────────────

interface GroupedCat {
  name: string
  products: Product[]
  onSale: number
  shown: number
  hasMore: boolean
}

function CategorySection({
  group, index, expanded, onToggleExpand,
}: {
  group: GroupedCat
  index: number
  expanded: boolean
  onToggleExpand: () => void
}) {
  return (
    <div className="mb-8">
      <div className="border-t-2 border-gray-900 pt-3 flex justify-between">
        {/* Left: name · count · view link */}
        <div className="flex items-baseline gap-[10px]">
          <span className="text-[11px] font-[800] tracking-[0.14em] uppercase">
            {group.name}
          </span>
          <span className="text-[11px] text-gray-400">
            {group.onSale} on sale
          </span>
          <Link to="/categories" className="text-[11px] font-semibold text-red-700">
            View category →
          </Link>
        </div>

        {/* Right: expand / collapse */}
        <div>
          {group.hasMore ? (
            <button
              onClick={onToggleExpand}
              className="text-xs font-semibold text-red-700 bg-transparent border-none cursor-pointer flex items-center gap-1 p-0 font-sans"
            >
              Show more <ChevronDown size={12} />
            </button>
          ) : group.shown > 3 && expanded ? (
            <button
              onClick={onToggleExpand}
              className="text-xs font-semibold text-gray-500 bg-transparent border-none cursor-pointer flex items-center gap-1 p-0 font-sans"
            >
              Show less <ChevronUp size={12} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-1">
        {group.products.map(p => (
          <ProductRow key={p.id} product={p} />
        ))}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('discount')
  const [catFilter, setCatFilter] = useState('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const { data, isLoading: productsLoading } = getProducts()

  const stats = useMemo(() => {
    const onSale = PRODUCTS.filter(isOnSale)
    const avgDiscount = onSale.length
      ? Math.round(onSale.reduce((s, p) => s + discountPct(p), 0) / onSale.length)
      : 0
    return { total: PRODUCTS.length, onSale: onSale.length, categories: CATEGORIES.length, avgDiscount }
  }, [])

  const grouped = useMemo<GroupedCat[]>(() => {
    const q = search.trim().toLowerCase()
    const cats = catFilter !== 'all' ? [catFilter] : [...CATEGORIES]

    return cats.map(cat => {
      const allSale = PRODUCTS.filter(p => p.category === cat && isOnSale(p))
      const filtered = q
        ? allSale.filter(p => p.name.toLowerCase().includes(q))
        : allSale
      const sorted = sortProducts(filtered, sort)
      const isOpen = expanded[cat] || q !== ''
      return {
        name: cat,
        products: isOpen ? sorted : sorted.slice(0, 3),
        onSale: allSale.length,
        shown: filtered.length,
        hasMore: !isOpen && filtered.length > 3,
      }
    }).filter(g => g.shown > 0)
  }, [search, sort, catFilter, expanded])

  const toggleExpand = (cat: string) => {
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'discount', label: 'Most Discounted' },
    { key: 'price', label: 'Price: Low → High' },
    { key: 'name', label: 'Name: A → Z' },
    { key: 'atl', label: 'At All-Time Low' },
  ]

  return (
    <div className="max-w-[1100px] mx-auto px-6 pb-[60px]">

      {/* ── Swiss Masthead ── */}
      <div className="pt-6">
        {/* Supertitle row */}
        <div className="flex justify-between items-center text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-400 border-b border-stone-200 pb-[10px]">
          <span>Uniqlo Canada · Price Tracker</span>
          <span>Updated daily</span>
        </div>

        {/* Title + search row */}
        <div className="grid grid-cols-[1fr_auto] gap-[48px] items-end py-5">
          <h1 className="text-[52px] font-black tracking-[-0.03em] leading-none m-0 whitespace-nowrap">
            Uniqlo <span className="text-red-700">Tracker</span>
          </h1>

          <input
            type="text"
            placeholder="Search products"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-0 border-b-2 border-gray-300 focus:border-sky-700 outline-none px-0 py-1 text-base w-[260px] text-right font-normal text-gray-900 transition-[border-color] duration-150 placeholder:italic placeholder:text-gray-400 mb-1 font-sans"
          />
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-4 border-t-[3px] border-sky-700 border-l border-r border-stone-200 mb-11">
        {[
          { value: stats.total, label: 'Products Tracked' },
          { value: stats.onSale, label: 'On Sale Now' },
          { value: stats.categories, label: 'Categories' },
          { value: `${stats.avgDiscount}%`, label: 'Avg. Discount' },
        ].map((s, i) => (
          <div
            key={i}
            className={`px-4 py-[14px] border-b border-stone-200 ${i < 3 ? 'border-r border-stone-200' : ''}`}
          >
            <div className="text-[30px] font-black tracking-[-0.03em] leading-none text-sky-700">
              {s.value}
            </div>
            <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-400 mt-1">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main layout ── */}
      <div className="grid grid-cols-[180px_1fr] gap-[40px]">

        {/* ── Sidebar ── */}
        <div>
          <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase border-b border-stone-200 pb-2 mb-3">
            Sort by
          </div>
          <div className="flex flex-col gap-0.5">
            {sortOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSort(opt.key)}
                className={`flex items-center gap-2 text-[13px] cursor-pointer py-1 transition-colors select-none bg-transparent border-none font-sans text-left ${sort === opt.key ? 'text-gray-900 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 transition-[background] duration-150 ${sort === opt.key ? 'bg-red-700' : 'bg-gray-300'}`} />
                {opt.label}
              </button>
            ))}
          </div>

          <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase border-b border-stone-200 pb-2 mb-3 mt-7">
            Category
          </div>
          <div className="flex flex-col gap-0.5">
            {['all', ...CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                className={`flex items-center gap-2 text-[13px] cursor-pointer py-1 transition-colors select-none bg-transparent border-none font-sans text-left ${catFilter === cat ? 'text-gray-900 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 transition-[background] duration-150 ${catFilter === cat ? 'bg-red-700' : 'bg-gray-300'}`} />
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Products ── */}
        <div>
          {grouped.length === 0 ? (
            <div className="text-center py-[60px] text-gray-400">
              <div className="text-[32px] mb-3">∅</div>
              <div className="text-sm">No products match your search.</div>
            </div>
          ) : (
            grouped.map((group, i) => (
              <CategorySection
                key={group.name}
                group={group}
                index={i}
                expanded={!!expanded[group.name]}
                onToggleExpand={() => toggleExpand(group.name)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
