import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  PRODUCTS, CATEGORIES, discountPct, isAtl, isOnSale, genderLabel,
} from '../data/mockData'
import type { Product, SortKey } from '../types/types'
import { getCategories, getImage, getProducts } from '../data/api'
import PageLoader from '../components/PageLoader'

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
  const { data: imgSrc } = getImage(product.product_id)

  return (
    <div className="grid grid-cols-[48px_1fr_auto] sm:grid-cols-[60px_1fr_auto_auto_96px_52px] items-center gap-2 sm:gap-3 px-1 sm:px-2 py-2 border-b border-stone-200 cursor-pointer -mx-1 sm:-mx-2 transition-[background] duration-100 hover:bg-stone-100 group">
      {/* Thumbnail */}
      <div className="w-12 h-12 sm:w-[60px] sm:h-[60px] overflow-hidden shrink-0 bg-stone-100">
        {imgSrc
          ? <img src={imgSrc} alt={product.name} className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.08]" />
          : <div className="w-full h-full bg-stone-200 animate-pulse" />
        }
      </div>

      {/* Name + info */}
      <div>
        <div className="text-sm font-medium text-gray-900">{product.name}</div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {product.gender && <span className="text-stone-600 text-xs">{genderLabel(product.gender)}</span>}
          {atl && <span className="sm:hidden inline-flex items-center bg-sky-600 px-1 py-0.5 text-[9px] font-medium text-sky-100">ATL</span>}
        </div>
      </div>

      {/* ATL badge — desktop only */}
      <div className="hidden sm:block">
        {atl && <span className="inline-flex items-center bg-sky-600 px-1.5 py-0.5 text-xs font-medium text-sky-100">ATL</span>}
      </div>

      {/* SALE badge — desktop only */}
      <div className="hidden sm:block">
        <span className="inline-flex items-center bg-red-700 px-1.5 py-0.5 text-xs font-medium text-red-100">SALE</span>
      </div>

      {/* Price (+ discount on mobile) */}
      <div className="text-right">
        <div className="text-sm sm:text-base font-semibold">${product.price.toFixed(2)}</div>
        <div className="text-xs text-gray-400 line-through font-light">${product.regular_price.toFixed(2)}</div>
        <div className="sm:hidden text-xs font-bold text-emerald-600">−{pct}%</div>
      </div>

      {/* Discount % — desktop only */}
      <div className="hidden sm:block text-right">
        <span className="text-sm font-bold text-emerald-600">−{pct}%</span>
      </div>
    </div>
  )
}

// ─── Category Section ────────────────────────────────────────────────────────

interface GroupedCat {
  name: string
  products: Product[]
  onSale: number
}

function CategorySection({
  group, index, expanded, onToggleExpand,
}: {
  group: GroupedCat
  index: number
  expanded: boolean
  onToggleExpand: () => void
}) {
  console.log('group:', group)
  return (
    <div className="mb-8">
      <div className="border-t-2 border-gray-900 pt-3 flex flex-wrap justify-between gap-y-1">
        {/* Left: name · count · view link */}
        <div className="flex items-baseline gap-2 sm:gap-[10px] flex-wrap">
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
          {group.onSale > 3 && !expanded ? (
            <button
              onClick={onToggleExpand}
              className="text-xs font-semibold text-red-700 bg-transparent border-none cursor-pointer flex items-center gap-1 p-0 font-sans"
            >
              Show more <ChevronDown size={12} />
            </button>
          ) : group.onSale > 3 && expanded ? (
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
        {(expanded ? group.products : group.products.slice(0, 3)).map(p => (
          <ProductRow key={p.product_id} product={p} />
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
  const [onSale, setOnSale] = useState<Product[]>([])

  const { data: productsAPI = [], isLoading: productsLoading } = getProducts()
  const { data: categoriesAPI = [], isLoading: categoriesLoading } = getCategories()

  // const products = productsAPI?.products
  const products = productsAPI?.products
  const categories = categoriesAPI?.categories

  useEffect(() => setOnSale(products?.filter((p: Product) => p.price < p.regular_price) || []), [products])

  const avgDiscount = onSale.length ?
    (onSale.reduce(
      (acc, product: Product) => acc + (1 - product.price / product.regular_price),
      0
    ) / onSale.length) : 0


  const onSaleByCategory = useMemo<{[key: string]: Product[]}>(() => {
    const map: {[key: string]: Product[]} = {}
    onSale.forEach(element => {
      element.categories.forEach(categoryElement => {
        map[`${categoryElement}`] = [...(map[categoryElement] || []), element]
      })
    })
    return map
  }, [onSale])


  const filtered = useMemo<GroupedCat[]>(() => {
    const searchTerm = search.trim().toLowerCase()
    return Object.keys(onSaleByCategory).map(category => {
      const categoryItems = onSaleByCategory?.[category] || []
      const filterCategory = categoryItems.filter(p => p.name.toLowerCase().includes(searchTerm) || p.product_id.includes(searchTerm))

      return {
        name: category,
        products: sortProducts(filterCategory, sort),
        onSale: categoryItems.length,
      }
    }
    )

  }, [search, onSaleByCategory])

  const toggleExpand = (cat: string) => {
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'discount', label: 'Most Discounted' },
    { key: 'price', label: 'Price: Low → High' },
    { key: 'name', label: 'Name: A → Z' },
    { key: 'atl', label: 'At All-Time Low' },
  ]

  if (productsLoading || categoriesLoading) return <PageLoader />

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pb-[60px]">

      {/* ── Swiss Masthead ── */}
      <div className="pt-6">
        {/* Supertitle row */}
        <div className="flex justify-between items-center text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-400 border-b border-stone-200 pb-[10px]">
          <span>Uniqlo Canada · Price Tracker</span>
          <span className="hidden sm:inline">Updated daily</span>
        </div>

        {/* Title + search row */}
        <div className="flex flex-col sm:grid sm:grid-cols-[1fr_auto] gap-3 sm:gap-[48px] sm:items-end py-5">
          <h1 className="text-[36px] sm:text-[52px] font-black tracking-[-0.03em] leading-none m-0 whitespace-nowrap">
            Uniqlo <span className="text-red-700">Tracker</span>
          </h1>
          <input
            type="text"
            placeholder="Search products"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-0 border-b-2 border-gray-300 focus:border-sky-700 outline-none px-0 py-1 text-base w-full sm:w-[260px] text-left sm:text-right font-normal text-gray-900 transition-[border-color] duration-150 placeholder:italic placeholder:text-gray-400 mb-1 font-sans"
          />
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-t-[3px] border-t-zinc-700 border-l border-l-zinc-700 border-r border-r-zinc-700 mb-8 sm:mb-11">
        {[
          { value: products.length, label: 'Products Tracked' },
          { value: onSale.length, label: 'On Sale Now' },
          { value: categories.length, label: 'Categories' },
          { value: `${(avgDiscount * 100).toFixed(0)}%`, label: 'Avg. Discount' },
        ].map((s, i) => (
          <div
            key={i}
            className={`px-4 py-[14px] border-b border-b-zinc-700 ${
              i === 0 || i === 2 ? 'border-r border-r-zinc-700' : i === 1 ? 'sm:border-r sm:border-r-zinc-700' : ''
            }`}
          >
            <div className="text-[24px] sm:text-[30px] font-black tracking-[-0.03em] leading-none text-red-700">
              {s.value}
            </div>
            <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-400 mt-1">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main layout ── */}
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-10">

        {/* ── Sidebar — desktop only ── */}
        <div className="hidden sm:block">
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

          {/* ── Mobile filters ── */}
          <div className="sm:hidden mb-6 space-y-3">
            <div>
              <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase mb-2">Sort</div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
                {sortOptions.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setSort(opt.key)}
                    className={`shrink-0 text-[11px] font-semibold px-3 py-1.5 border transition-colors font-sans ${sort === opt.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-transparent text-gray-600 border-gray-300'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase mb-2">Category</div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
                {['all', ...CATEGORIES].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCatFilter(cat)}
                    className={`shrink-0 text-[11px] font-semibold px-3 py-1.5 border transition-colors font-sans ${catFilter === cat ? 'bg-gray-900 text-white border-gray-900' : 'bg-transparent text-gray-600 border-gray-300'}`}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-[60px] text-gray-400">
              <div className="text-[32px] mb-3">∅</div>
              <div className="text-sm">No products match your search.</div>
            </div>
          ) : (
            filtered.map((group, i) => (
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
