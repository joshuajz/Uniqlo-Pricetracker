import type { Product } from '../types/types.ts'
import type { Market } from './markets.ts'

export interface SavedProduct {
  product: Product
  priceWhenSaved: number
  savedAt: string
}
export interface SavedStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const savedStorageKey = (market: Market) => `uniqlo-saved:v1:${market.code}`
const price = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))

export function parseSavedProducts(raw: string | null): SavedProduct[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw)
    if (data?.version !== 1 || !Array.isArray(data.products)) return []
    const ids = new Set<string>()
    return data.products.filter((entry: SavedProduct) => {
      const p = entry?.product
      if (!p || typeof p.product_id !== 'string' || !p.product_id || ids.has(p.product_id)
        || typeof p.name !== 'string' || !price(p.price) || !price(p.regular_price) || !price(p.lowest_price)
        || typeof p.url !== 'string' || typeof p.datetime !== 'string' || typeof p.is_all_time_low !== 'boolean'
        || !Array.isArray(p.categories) || !p.categories.every(c => typeof c === 'string')
        || !price(entry.priceWhenSaved) || !date(entry.savedAt)) return false
      ids.add(p.product_id)
      return true
    }).map((entry: SavedProduct) => ({ ...entry, product: { ...entry.product, attributes: undefined } }))
  } catch { return [] }
}

export function readSavedProducts(storage: SavedStorage, market: Market) {
  try { return { products: parseSavedProducts(storage.getItem(savedStorageKey(market))), available: true } }
  catch { return { products: [] as SavedProduct[], available: false } }
}

export function writeSavedProducts(storage: SavedStorage, market: Market, products: SavedProduct[]) {
  try { storage.setItem(savedStorageKey(market), JSON.stringify({ version: 1, products })); return true }
  catch { return false }
}

// Saving an already saved item must never reset its original comparison price.
export function addSavedProduct(entries: SavedProduct[], product: Product, savedAt = new Date().toISOString()) {
  return entries.some(entry => entry.product.product_id === product.product_id) ? entries
    : [...entries, { product, priceWhenSaved: product.price, savedAt }]
}

export function savedPriceChange(current: number, baseline: number) {
  const cents = Math.round(current * 100) - Math.round(baseline * 100)
  return { amount: cents / 100, percent: Math.round(baseline * 100) > 0 ? Math.round(Math.abs(cents) / Math.round(baseline * 100) * 100) : null }
}
