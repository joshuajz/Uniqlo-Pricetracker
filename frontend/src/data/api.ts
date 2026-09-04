import { queryOptions, useQuery } from '@tanstack/react-query'
import type { ProductsAPI, ProductDetail } from '../types/types'
import { requestJSON, shouldRetryRequest } from '../lib/api-client'
export { ApiError } from '../lib/api-client'

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
export const getProducts = () => useQuery({
  queryKey: ['products'],
  queryFn: ({ signal }) => requestJSON<ProductsAPI>(`${API_URL}/products`, signal),
  staleTime: 5 * 60 * 1000,
  retry: shouldRetryRequest,
  retryDelay: attempt => Math.min(1000 * 2 ** attempt, 4000),
})
export const productDetailOptions = (productId: string) => queryOptions({
  queryKey: ['product', productId],
  queryFn: ({ signal }) => requestJSON<ProductDetail>(`${API_URL}/product/${encodeURIComponent(productId)}`, signal),
  staleTime: 5 * 60 * 1000,
  retry: shouldRetryRequest,
  retryDelay: attempt => Math.min(1000 * 2 ** attempt, 4000),
})
export const getProductDetail = (productId: string) => useQuery(productDetailOptions(productId))
// Native lazy-loaded images use browser caching and avoid retaining blob URLs.
export const productImageUrl = (productId: string) => `${API_URL}/product/${encodeURIComponent(productId)}/image`
