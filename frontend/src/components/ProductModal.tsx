import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import posthog from 'posthog-js'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts'
import { discountPct, isOnSale } from '../data/mockData'
import type { Product } from '../types/types'
import { getImage, getProductDetail } from '../data/api'
import { useTheme } from '../context/ThemeContext'

export function productHue(id: string): number {
  return id.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0) % 360
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(new Date(iso))
}

// ─── Colour extraction ────────────────────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, Math.round(l * 100)]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  switch (max) {
    case r:  h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
    case g:  h = ((b - r) / d + 2) / 6; break
    default: h = ((r - g) / d + 4) / 6
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

// Samples a blob-URL image and returns HSL for a randomly chosen top-N frequent colour,
// skipping transparent, near-white, and near-black pixels.
function useImagePalette(src: string | undefined, topN = 3): [number, number, number] | null {
  const [hsl, setHsl] = useState<[number, number, number] | null>(null)

  useEffect(() => {
    if (!src) return
    setHsl(null)

    const img = new Image()
    img.onload = () => {
      const SIZE = 64
      const canvas = document.createElement('canvas')
      canvas.width = SIZE
      canvas.height = SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.drawImage(img, 0, 0, SIZE, SIZE)
      const { data } = ctx.getImageData(0, 0, SIZE, SIZE)

      const freq = new Map<string, { count: number; r: number; g: number; b: number }>()

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
        if (a < 128) continue                          // transparent
        if (r > 218 && g > 218 && b > 218) continue   // near-white
        if (r < 22  && g < 22  && b < 22)  continue   // near-black

        // quantise into 32-step buckets
        const qr = Math.round(r / 32) * 32
        const qg = Math.round(g / 32) * 32
        const qb = Math.round(b / 32) * 32
        const key = `${qr},${qg},${qb}`
        const entry = freq.get(key)
        if (entry) entry.count++
        else freq.set(key, { count: 1, r: qr, g: qg, b: qb })
      }

      if (freq.size === 0) return

      const top = [...freq.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, topN)
      const pick = top[Math.floor(Math.random() * top.length)]
      setHsl(rgbToHsl(pick.r, pick.g, pick.b))
    }

    img.src = src
  }, [src])

  return hsl
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function ProductModal({ product: p, onClose }: { product: Product; onClose: () => void }) {
  const sale = isOnSale(p)
  const atl  = p.is_all_time_low
  const pct  = discountPct(p)
  const savings = p.regular_price - p.price

  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Fire once when the modal mounts
  useEffect(() => {
    posthog.capture('product_modal_opened', {
      product_id: p.product_id,
      product_name: p.name,
      price: p.price,
      regular_price: p.regular_price,
      discount_pct: pct,
      is_atl: atl,
      is_on_sale: sale,
      category: p.categories[0] ?? '',
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCloseBackdrop = () => {
    posthog.capture('product_modal_closed', { product_id: p.product_id, closed_via: 'backdrop' })
    onClose()
  }

  const handleCloseButton = () => {
    posthog.capture('product_modal_closed', { product_id: p.product_id, closed_via: 'button' })
    onClose()
  }

  const { data: detail, isLoading: detailLoading } = getProductDetail(p.product_id)
  const { data: imgSrc } = getImage(p.product_id)
  const palette = useImagePalette(imgSrc)

  const fallbackGradient = isDark
    ? `linear-gradient(160deg, #1c1917, #292524)`
    : `linear-gradient(160deg, #f5f5f4, #e7e5e4)`

  // Palette gradient — clamp lightness to a dark, rich range
  const paletteGradient = palette
    ? (() => {
        const [h, s, l] = palette
        const s1 = Math.max(s, 22)
        const l1 = Math.min(Math.max(l, 20), 42)
        const l2 = Math.min(l1 + 16, 58)
        return `linear-gradient(160deg, hsl(${h}, ${s1}%, ${l1}%), hsl(${(h + 15) % 360}, ${Math.max(s1 - 6, 16)}%, ${l2}%))`
      })()
    : null

  const chartData = detail?.datapoints?.map((dp: { price: number; datetime: string }) => ({
    price: dp.price,
    date: formatDate(dp.datetime),
  })) ?? []

  const yMin = chartData.length ? Math.min(...chartData.map((d: { price: number }) => d.price)) : 0
  const yMax = chartData.length ? Math.max(...chartData.map((d: { price: number }) => d.price)) : 0
  const yPad = (yMax - yMin) * 0.2 || 5
  const yDomain: [number, number] = [Math.max(0, yMin - yPad), yMax + yPad]

  const chartReady = !detailLoading && !!detail
  const hasEnoughData = chartData.length >= 2

  // Theme-aware chart colours
  const chartStroke      = isDark ? '#d6d3d1' : '#111827'
  const chartGridStroke  = isDark ? '#292524' : '#f3f4f6'
  const chartTickFill    = isDark ? '#78716c' : '#9ca3af'
  const chartRefStroke   = isDark ? '#44403c' : '#d1d5db'
  const chartRefLblFill  = isDark ? '#78716c' : '#9ca3af'
  const tooltipBg        = isDark ? '#1c1917' : '#ffffff'
  const tooltipBorder    = isDark ? '#44403c' : '#e5e7eb'
  const tooltipColor     = isDark ? '#f5f5f4' : '#111827'
  const tooltipLblColor  = isDark ? '#78716c' : '#6b7280'

  return (
    <div
      onClick={handleCloseBackdrop}
      className="fixed inset-0 bg-black/45 z-[200] flex items-center justify-center p-3 sm:p-6"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-stone-900 max-w-[520px] w-full max-h-[90vh] overflow-auto relative transition-colors duration-200"
      >
        {/* Close button */}
        <button
          onClick={handleCloseButton}
          className="absolute top-3 right-3 z-20 bg-black/10 dark:bg-white/10 border-none text-gray-600 dark:text-stone-300 p-[5px_7px] cursor-pointer flex items-center hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
        >
          <X size={13} />
        </button>

        {/* ── Header: image + info side by side ── */}
        <div className="flex items-stretch">

          {/* Image column — two gradient layers so palette cross-fades in */}
          <div className="w-[130px] sm:w-[150px] shrink-0 relative min-h-[160px] sm:min-h-[180px]">
            {/* Fallback gradient (always visible underneath) */}
            <div className="absolute inset-0" style={{ background: fallbackGradient }} />
            {/* Palette gradient — fades in once extracted */}
            <div
              className="absolute inset-0 transition-opacity duration-700"
              style={{ background: paletteGradient ?? fallbackGradient, opacity: paletteGradient ? 1 : 0 }}
            />
            {imgSrc && (
              <img
                src={imgSrc}
                alt={p.name}
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
            <div className="absolute bottom-2.5 left-2.5 flex flex-col gap-1 z-10">
              {atl  && <span className="inline-flex items-center bg-sky-600 text-sky-100 text-[9px] font-bold tracking-[0.06em] px-1.5 py-0.5 leading-[1.4]">ATL</span>}
              {sale && <span className="inline-flex items-center bg-red-700 text-red-100 text-[9px] font-bold tracking-[0.06em] px-1.5 py-0.5 leading-[1.4]">SALE</span>}
            </div>
          </div>

          {/* Info column */}
          <div className="flex-1 min-w-0 p-4 pr-10 flex flex-col justify-center">
            <div className="text-[10px] font-bold tracking-[0.12em] text-gray-400 dark:text-stone-500 uppercase mb-1.5 truncate">
              {p.categories.join(' / ')}
            </div>
            <h2 className="text-[14px] sm:text-[16px] font-[800] tracking-[-0.02em] leading-[1.25] mb-4 text-gray-900 dark:text-stone-100">
              {p.name}
            </h2>

            {/* Price grid */}
            <div className="grid grid-cols-3 gap-x-2 gap-y-0">
              {[
                { label: 'Current', value: `$${p.price.toFixed(2)}`,         highlight: true },
                { label: 'Regular', value: `$${p.regular_price.toFixed(2)}` },
                { label: 'ATL',     value: `$${p.lowest_price.toFixed(2)}` },
              ].map(item => (
                <div key={item.label} className={`border-t-2 pt-2 ${item.highlight ? 'border-red-600' : 'border-gray-200 dark:border-stone-700'}`}>
                  <div className="text-[9px] font-semibold tracking-[0.08em] text-gray-300 dark:text-stone-600 uppercase">
                    {item.label}
                  </div>
                  <div className={`text-[13px] sm:text-[15px] font-[800] mt-0.5 ${item.highlight ? 'text-red-600' : 'text-gray-900 dark:text-stone-100'}`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Chart ── */}
        <div className="border-t border-gray-100 dark:border-stone-800 px-4 pt-4 pb-3">
          <div className="text-[10px] font-bold tracking-[0.12em] text-gray-300 dark:text-stone-600 uppercase mb-3">
            Price History
          </div>
          {!chartReady ? (
            <div className="h-[110px] bg-gray-100 dark:bg-stone-800 animate-pulse" />
          ) : !hasEnoughData ? (
            <div className="h-[72px] flex items-center justify-center text-[11px] text-gray-300 dark:text-stone-600 border border-dashed border-gray-200 dark:border-stone-700">
              Not enough history yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={110}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={chartGridStroke} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: chartTickFill }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 9, fill: chartTickFill }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${v}`}
                  width={36}
                />
                <Tooltip
                  formatter={(v: number) => [`$${v.toFixed(2)}`, 'Price']}
                  labelStyle={{ fontSize: 10, color: tooltipLblColor }}
                  contentStyle={{
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: 0,
                    padding: '4px 10px',
                    fontSize: 11,
                    background: tooltipBg,
                    color: tooltipColor,
                  }}
                  cursor={{ stroke: chartRefStroke, strokeWidth: 1 }}
                />
                {detail?.regular_price && (
                  <ReferenceLine
                    y={detail.regular_price}
                    stroke={chartRefStroke}
                    strokeDasharray="3 3"
                    label={{ value: 'Regular', position: 'insideTopRight', fontSize: 8, fill: chartRefLblFill }}
                  />
                )}
                <Area
                  type="linear"
                  dataKey="price"
                  stroke={chartStroke}
                  strokeWidth={1.5}
                  fill={chartStroke}
                  fillOpacity={0.05}
                  dot={false}
                  activeDot={{ r: 3, fill: chartStroke, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Sale banner ── */}
        {sale && (
          <div className="mx-4 mb-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-[14px] py-[10px] flex justify-between items-center">
            <span className="text-[12px] text-red-600 dark:text-red-400 font-semibold">
              You save ${savings.toFixed(2)} ({pct}% off)
            </span>
            {atl && <span className="text-[11px] font-bold text-gray-900 dark:text-stone-100">★ ATL</span>}
          </div>
        )}

        {/* ── CTA ── */}
        <div className="px-4 pb-4">
          <a
            href={detail?.url ?? p.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => posthog.capture('view_on_uniqlo_clicked', {
              product_id: p.product_id,
              product_name: p.name,
              price: p.price,
              is_atl: atl,
              is_on_sale: sale,
            })}
            className="block w-full py-[11px] bg-gray-900 dark:bg-stone-100 text-white dark:text-stone-900 text-center text-[13px] font-semibold tracking-[0.06em] font-sans transition-[background,color] duration-150 hover:bg-red-600 dark:hover:bg-red-600 dark:hover:text-white no-underline"
          >
            View on Uniqlo →
          </a>
        </div>
      </div>
    </div>
  )
}
