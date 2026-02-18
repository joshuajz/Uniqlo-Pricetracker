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
      case 'price':    return a.price - b.price
      case 'name':     return a.name.localeCompare(b.name)
      case 'atl':      return (isAtl(a) ? 0 : 1) - (isAtl(b) ? 0 : 1)
      default:         return discountPct(b) - discountPct(a)
    }
  })
}

// ─── Product Row ─────────────────────────────────────────────────────────────

function ProductRow({ product: p }: { product: Product }) {
  const pct = discountPct(p)
  const atl = isAtl(p)

  return (
    <div className="product-row">
      <div className="thumb">
        <div
          className="thumb-img"
          style={{ background: `linear-gradient(160deg, hsl(${p.hue}, 28%, 36%), hsl(${p.hue + 20}, 22%, 54%))` }}
        />
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#111', lineHeight: 1.2 }}>{p.name}</div>
        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{genderLabel(p.gender)}</div>
      </div>

      <div style={{ width: 34 }}>
        {atl && <span className="badge badge-atl">ATL</span>}
      </div>

      <div style={{ width: 34 }}>
        <span className="badge badge-sale">SALE</span>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>${p.price.toFixed(2)}</div>
        <div style={{ fontSize: 11, color: '#bbb', textDecoration: 'line-through', marginTop: 1 }}>
          ${p.regular.toFixed(2)}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#307351' }}>
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
  onSale: number   // total on sale in category (stable, for header)
  shown: number    // count matching current filters (for expand button)
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
      <div
        className={`cat-header ${index === 0 ? 'cat-header-accent' : ''}`}
        style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
      >
        {/* Left: name · count · view link */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            {group.name}
          </span>
          <span style={{ fontSize: 11, color: '#aaa' }}>
            {group.onSale} on sale
          </span>
          <Link to="/categories" style={{ fontSize: 11, fontWeight: 600, color: '#B3001B' }}>
            View category →
          </Link>
        </div>

        {/* Right: expand / collapse */}
        <div>
          {group.hasMore ? (
            <button
              onClick={onToggleExpand}
              style={{
                fontSize: 12, fontWeight: 600, color: '#B3001B',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, padding: 0,
                fontFamily: 'inherit',
              }}
            >
              Show all on sale <ChevronDown size={12} />
            </button>
          ) : group.shown > 3 && expanded ? (
            <button
              onClick={onToggleExpand}
              style={{
                fontSize: 12, fontWeight: 600, color: '#666',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, padding: 0,
                fontFamily: 'inherit',
              }}
            >
              Show less <ChevronUp size={12} />
            </button>
          ) : null}
        </div>
      </div>

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
      // Expand when user clicked, or when a search term is active
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
    { key: 'price',    label: 'Price: Low → High' },
    { key: 'name',     label: 'Name: A → Z' },
    { key: 'atl',      label: 'At All-Time Low' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 60px' }}>

      {/* ── Swiss Masthead ── */}
      <div style={{ paddingTop: 24 }}>
        {/* Supertitle row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#aaa',
          borderBottom: '1px solid #E8E4DF',
          paddingBottom: 10,
        }}>
          <span>Uniqlo Canada · Price Tracker</span>
          <span>Updated daily</span>
        </div>

        {/* Title + search row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 48,
          alignItems: 'end',
          padding: '20px 0 22px',
        }}>
          <h1 style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, margin: 0, whiteSpace: 'nowrap' }}>
            Uniqlo <span style={{ color: '#B3001B' }}>Tracker</span>
          </h1>

          <input
            type="text"
            placeholder="Search products"
            className="masthead-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              border: 'none',
              borderBottom: '2px solid #ccc',
              background: 'transparent',
              outline: 'none',
              padding: '4px 0',
              fontSize: 16,
              fontWeight: 400,
              width: 260,
              textAlign: 'right',
              fontFamily: 'inherit',
              color: '#111',
              transition: 'border-color 0.15s',
              marginBottom: 4,
            }}
            onFocus={e => (e.target.style.borderBottomColor = '#26547C')}
            onBlur={e => (e.target.style.borderBottomColor = '#ccc')}
          />
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        borderTop: '3px solid #26547C',
        borderLeft: '1px solid #E8E4DF',
        borderRight: '1px solid #E8E4DF',
        marginBottom: 44,
      }}>
        {[
          { value: stats.total,             label: 'Products Tracked' },
          { value: stats.onSale,            label: 'On Sale Now' },
          { value: stats.categories,        label: 'Categories' },
          { value: `${stats.avgDiscount}%`, label: 'Avg. Discount' },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              padding: '14px 16px',
              borderRight: i < 3 ? '1px solid #E8E4DF' : undefined,
              borderBottom: '1px solid #E8E4DF',
            }}
          >
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: '#26547C' }}>
              {s.value}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginTop: 4 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 40 }}>

        {/* ── Sidebar ── */}
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#aaa',
            textTransform: 'uppercase', borderBottom: '1px solid #E8E4DF',
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
                  background: sort === opt.key ? '#B3001B' : '#ddd',
                  transition: 'background 0.15s',
                }} />
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#aaa',
            textTransform: 'uppercase', borderBottom: '1px solid #E8E4DF',
            paddingBottom: 8, marginBottom: 12, marginTop: 28,
          }}>
            Category
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {['all', ...CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                className={`sort-option ${catFilter === cat ? 'active' : ''}`}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: catFilter === cat ? '#B3001B' : '#ddd',
                  transition: 'background 0.15s',
                }} />
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Products ── */}
        <div>
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
      </div>
    </div>
  )
}
