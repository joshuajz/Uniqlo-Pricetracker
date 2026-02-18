import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import {
  PRODUCTS, CATEGORIES, discountPct, isAtl, isOnSale, genderLabel,
} from '../data/mockData'
import type { Product, SortKey } from '../types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function sortProducts(products: Product[], key: SortKey): Product[] {
  return [...products].sort((a, b) => {
    switch (key) {
      case 'price':    return a.price - b.price
      case 'name':     return a.name.localeCompare(b.name)
      case 'atl':      return (isAtl(a) ? 0 : 1) - (isAtl(b) ? 0 : 1)
      default:         return discountPct(b) - discountPct(a) // discount
    }
  })
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className={accent ? 'stat-card-accent' : 'stat-card'} style={{ paddingTop: 12 }}>
      <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

// ─── Product Row ─────────────────────────────────────────────────────────────

function ProductRow({ product: p }: { product: Product }) {
  const pct = discountPct(p)
  const atl = isAtl(p)
  const sale = isOnSale(p)

  return (
    <div className="product-row">
      {/* Colour swatch */}
      <div style={{
        width: 16, height: 16, flexShrink: 0,
        background: `hsl(${p.hue}, 22%, 44%)`,
      }} />

      {/* Name + gender */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#111', lineHeight: 1.2 }}>{p.name}</div>
        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{genderLabel(p.gender)}</div>
      </div>

      {/* ATL badge */}
      <div style={{ width: 34 }}>
        {atl && <span className="badge badge-atl">ATL</span>}
      </div>

      {/* SALE badge */}
      <div style={{ width: 34 }}>
        {sale && <span className="badge badge-sale">SALE</span>}
      </div>

      {/* Price */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>${p.price.toFixed(2)}</div>
        {sale && (
          <div style={{ fontSize: 11, color: '#bbb', textDecoration: 'line-through', marginTop: 1 }}>
            ${p.regular.toFixed(2)}
          </div>
        )}
      </div>

      {/* Discount */}
      <div style={{ textAlign: 'right' }}>
        {sale && (
          <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>
            −{pct}%
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Category Section ────────────────────────────────────────────────────────

interface GroupedCat {
  name: string
  products: Product[]
  total: number
  onSale: number
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
    <div style={{ marginBottom: 40 }}>
      {/* Header */}
      <div
        className={`cat-header ${index === 0 ? 'cat-header-accent' : ''}`}
        style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {group.name}
          </span>
          <span style={{ fontSize: 11, color: '#888' }}>
            {group.onSale} on sale
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {group.hasMore && (
            <span style={{ fontSize: 11, color: '#aaa' }}>
              Showing top 3 of {group.total}
            </span>
          )}
          {group.hasMore ? (
            <button
              onClick={onToggleExpand}
              style={{
                fontSize: 12, fontWeight: 600, color: '#dc2626',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, padding: 0,
              }}
            >
              Show all {group.total} <ChevronDown size={12} />
            </button>
          ) : group.total > 3 && expanded ? (
            <button
              onClick={onToggleExpand}
              style={{
                fontSize: 12, fontWeight: 600, color: '#666',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, padding: 0,
              }}
            >
              Show less <ChevronUp size={12} />
            </button>
          ) : (
            <Link
              to="/categories"
              style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}
            >
              View in categories →
            </Link>
          )}
        </div>
      </div>

      {/* Rows */}
      <div style={{ marginTop: 4 }}>
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

  const stats = useMemo(() => {
    const onSale = PRODUCTS.filter(isOnSale)
    const avgDiscount = onSale.length
      ? Math.round(onSale.reduce((s, p) => s + discountPct(p), 0) / onSale.length)
      : 0
    return { total: PRODUCTS.length, onSale: onSale.length, categories: CATEGORIES.length, avgDiscount }
  }, [])

  const grouped = useMemo<GroupedCat[]>(() => {
    const q = search.trim().toLowerCase()
    const isFiltering = q !== '' || catFilter !== 'all'
    const cats = catFilter !== 'all' ? [catFilter] : [...CATEGORIES]

    return cats.map(cat => {
      const all = PRODUCTS.filter(p => p.category === cat)
      const filtered = all.filter(p =>
        (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) &&
        (catFilter === 'all' || p.category === catFilter)
      )
      const sorted = sortProducts(filtered, sort)
      const isOpen = expanded[cat] || isFiltering
      return {
        name: cat,
        products: isOpen ? sorted : sorted.slice(0, 3),
        total: all.length,
        onSale: all.filter(isOnSale).length,
        hasMore: !isOpen && sorted.length > 3,
      }
    }).filter(g => g.products.length > 0)
  }, [search, sort, catFilter, expanded])

  const toggleExpand = (cat: string) => {
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'discount', label: 'Most Discounted' },
    { key: 'price',    label: 'Price: Low → High' },
    { key: 'name',     label: 'Name: A → Z' },
    { key: 'atl',      label: 'At All-Time Low' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 60px' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 42, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6 }}>
          Uniqlo <span style={{ color: '#dc2626' }}>Tracker</span>
        </h1>
        <p style={{ fontSize: 14, color: '#888' }}>
          Real-time price tracking across {stats.total} Uniqlo products.
        </p>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 44 }}>
        <StatCard value={stats.total}          label="Products Tracked" accent />
        <StatCard value={stats.onSale}          label="On Sale Now" />
        <StatCard value={stats.categories}      label="Categories" />
        <StatCard value={`${stats.avgDiscount}%`} label="Avg. Discount" />
      </div>

      {/* ── Controls ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 40, marginBottom: 48 }}>

        {/* Sort list */}
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#888',
            textTransform: 'uppercase', borderBottom: '1px solid #e8e8e8',
            paddingBottom: 8, marginBottom: 12,
          }}>
            Sort by
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sortOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSort(opt.key)}
                className={`sort-option ${sort === opt.key ? 'active' : ''}`}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: sort === opt.key ? '#dc2626' : '#ddd',
                  transition: 'background 0.15s',
                }} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search + category filter */}
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {/* Search */}
            <div style={{ flex: 1, position: 'relative' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }}
              />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', paddingLeft: 32, paddingRight: 12,
                  paddingTop: 9, paddingBottom: 9,
                  fontSize: 13, border: '1px solid #ddd',
                  background: '#fff', outline: 'none',
                  fontFamily: 'inherit', color: '#111',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = '#dc2626')}
                onBlur={e => (e.target.style.borderColor = '#ddd')}
              />
            </div>

            {/* Category dropdown */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <select
                value={catFilter}
                onChange={e => setCatFilter(e.target.value)}
                style={{
                  appearance: 'none', fontSize: 13, border: '1px solid #ddd',
                  background: '#fff', padding: '9px 32px 9px 12px',
                  fontFamily: 'inherit', color: '#111', cursor: 'pointer',
                  outline: 'none', transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = '#dc2626')}
                onBlur={e => (e.target.style.borderColor = '#ddd')}
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <ChevronDown
                size={12}
                style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none',
                }}
              />
            </div>
          </div>

          {/* Result count */}
          {(search || catFilter !== 'all') && (
            <div style={{ fontSize: 12, color: '#888' }}>
              {grouped.reduce((n, g) => n + g.products.length, 0)} results
              {search && <> for "<strong style={{ color: '#111' }}>{search}</strong>"</>}
              {catFilter !== 'all' && <> in <strong style={{ color: '#111' }}>{catFilter}</strong></>}
            </div>
          )}
        </div>
      </div>

      {/* ── Product sections ── */}
      {grouped.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>∅</div>
          <div style={{ fontSize: 14 }}>No products match your search.</div>
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
  )
}
