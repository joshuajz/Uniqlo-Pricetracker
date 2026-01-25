import type { ProductsResponse, ProductDetail, CategoryResponse } from '@/types'

const API_BASE = '/api'
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes in milliseconds

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_DURATION,
  })
}

export async function getProducts(): Promise<ProductsResponse> {
  const cacheKey = 'products'
  const cached = getCached<ProductsResponse>(cacheKey)
  if (cached) return cached

  const response = await fetch(`${API_BASE}/products`)
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }
  const data = await response.json()
  setCache(cacheKey, data)
  return data
}

export async function getProduct(id: string): Promise<ProductDetail> {
  const cacheKey = `product:${id}`
  const cached = getCached<ProductDetail>(cacheKey)
  if (cached) return cached

  const response = await fetch(`${API_BASE}/product/${id}`)
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }
  const data = await response.json()
  setCache(cacheKey, data)
  return data
}

export async function getProductsByCategory(category: string): Promise<CategoryResponse> {
  const cacheKey = `category:${category}`
  const cached = getCached<CategoryResponse>(cacheKey)
  if (cached) return cached

  const response = await fetch(`${API_BASE}/category/${encodeURIComponent(category)}`)
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }
  const data = await response.json()
  setCache(cacheKey, data)
  return data
}

// Utility to manually clear cache if needed
export function clearCache(): void {
  cache.clear()
}
