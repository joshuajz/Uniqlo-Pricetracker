import { useMarket } from '../context/MarketContext'
import type { Market } from '../lib/markets'
import { queryOptions, useQuery } from '@tanstack/react-query'
import type { ProductsAPI, ProductDetail } from '../types/types'
import { requestJSON, shouldRetryRequest } from '../lib/api-client'
export { ApiError } from '../lib/api-client'

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
export const useProducts = () => {
  const market = useMarket()
  return useQuery({
    queryKey: ['products', market.code],
    queryFn: ({ signal }) => requestJSON<ProductsAPI>(`${API_URL}/${market.slug}/products`, signal),
    staleTime: 5 * 60 * 1000,
    retry: shouldRetryRequest,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 4000),
  })
}
export const productDetailOptions = (productId: string, market: Market) => queryOptions({
  queryKey: ['product', market.code, productId],
  queryFn: ({ signal }) => requestJSON<ProductDetail>(`${API_URL}/${market.slug}/product/${encodeURIComponent(productId)}`, signal),
  staleTime: 5 * 60 * 1000,
  retry: shouldRetryRequest,
  retryDelay: attempt => Math.min(1000 * 2 ** attempt, 4000),
})
export const useProductDetail = (productId: string) => useQuery(productDetailOptions(productId, useMarket()))
// Native lazy-loaded images use browser caching and avoid retaining blob URLs.
export const productImageUrl = (productId: string, market: Market) => `${API_URL}/${market.slug}/product/${encodeURIComponent(productId)}/image`
