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
    <div className="mosaic-tile" onClick={() => onSelect(p)}>
      {/* Color block */}
      <div style={{
        background: `hsl(${p.hue}, 22%, 44%)`,
        aspectRatio: '4/3',
        width: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        padding: 8,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {atl  && <span className="badge badge-atl">ATL</span>}
          {sale && <span className="badge badge-sale">SALE</span>}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '10px 10px 12px' }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#111',
          lineHeight: 1.3, marginBottom: 6,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {p.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>${p.price.toFixed(2)}</span>
          {sale && (
            <>
              <span style={{ fontSize: 11, color: '#bbb', textDecoration: 'line-through' }}>${p.regular.toFixed(2)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>−{pct}%</span>
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
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', maxWidth: 480, width: '100%',
          maxHeight: '90vh', overflow: 'auto',
        }}
      >
        {/* Color block header */}
        <div style={{
          background: `hsl(${p.hue}, 22%, 44%)`,
          height: 180,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 16,
        }}>
          <button
            onClick={onClose}
            style={{
              alignSelf: 'flex-end', background: 'rgba(0,0,0,0.2)',
              border: 'none', color: '#fff', padding: '4px 6px',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            {atl  && <span className="badge badge-atl">ATL</span>}
            {sale && <span className="badge badge-sale">SALE</span>}
          </div>
        </div>

        {/* Product info */}
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#888', textTransform: 'uppercase', marginBottom: 6 }}>
            {p.category}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, lineHeight: 1.2 }}>
            {p.name}
          </h2>

          {/* Price grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Current Price', value: `$${p.price.toFixed(2)}`, highlight: true },
              { label: 'Regular Price', value: `$${p.regular.toFixed(2)}` },
              { label: 'All-Time Low',  value: `$${p.lowest.toFixed(2)}` },
            ].map(item => (
              <div key={item.label} style={{ borderTop: `2px solid ${item.highlight ? '#dc2626' : '#e8e8e8'}`, paddingTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: '#bbb', textTransform: 'uppercase' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: item.highlight ? '#dc2626' : '#111' }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {sale && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                You save ${savings.toFixed(2)} ({pct}% off)
              </span>
              {atl && <span style={{ fontSize: 11, fontWeight: 700, color: '#111' }}>★ All-Time Low</span>}
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              marginTop: 20, width: '100%', padding: '11px 0',
              background: '#111', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 600, letterSpacing: '0.06em',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#dc2626')}
            onMouseLeave={e => (e.currentTarget.style.background = '#111')}
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
    <div style={{ borderTop: `3px solid ${index === 0 ? '#dc2626' : '#111'}` }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#111' }}>
            {name}
          </span>
          <span style={{ fontSize: 12, color: '#888' }}>
            {products.length} products
          </span>
          {onSaleCount > 0 && (
            <span style={{ fontSize: 12 }}>
              <span style={{ color: '#dc2626', fontWeight: 600 }}>{onSaleCount}</span>
              <span style={{ color: '#aaa' }}> on sale</span>
            </span>
          )}
          {atlCount > 0 && (
            <span className="badge badge-atl" style={{ verticalAlign: 'middle' }}>
              {atlCount} ATL
            </span>
          )}
        </div>
        <div style={{ color: '#bbb', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#bbb' }}>{isOpen ? 'Collapse' : 'Expand'}</span>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {/* Mosaic grid */}
      {isOpen && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 12,
          paddingBottom: 28,
        }}>
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
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 60px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
          Browse <span style={{ color: '#dc2626' }}>Categories</span>
        </h1>
        <p style={{ fontSize: 13, color: '#888', marginTop: 6 }}>
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
