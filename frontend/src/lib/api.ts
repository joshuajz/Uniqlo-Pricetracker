import type {
  Product,
  PriceHistory,
  Category,
  Stats,
  PaginatedResponse,
  Subscription,
} from '@/types'

const API_BASE = '/api'

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function getStats(): Promise<Stats> {
  return fetchJson<Stats>('/stats')
}

export async function getProducts(params?: {
  page?: number
  limit?: number
  sort?: string
  category?: string
  minPrice?: number
  maxPrice?: number
}): Promise<PaginatedResponse<Product>> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.sort) searchParams.set('sort', params.sort)
  if (params?.category) searchParams.set('category', params.category)
  if (params?.minPrice) searchParams.set('minPrice', String(params.minPrice))
  if (params?.maxPrice) searchParams.set('maxPrice', String(params.maxPrice))

  const query = searchParams.toString()
  return fetchJson<PaginatedResponse<Product>>(`/products${query ? `?${query}` : ''}`)
}

export async function searchProducts(
  query: string,
  params?: { page?: number; limit?: number }
): Promise<PaginatedResponse<Product>> {
  const searchParams = new URLSearchParams({ q: query })
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))

  return fetchJson<PaginatedResponse<Product>>(`/products/search?${searchParams}`)
}

export async function getProduct(id: string): Promise<Product> {
  return fetchJson<Product>(`/products/${id}`)
}

export async function getPriceHistory(
  id: string,
  days?: number
): Promise<PriceHistory> {
  const params = days ? `?days=${days}` : ''
  return fetchJson<PriceHistory>(`/products/${id}/history${params}`)
}

export async function getCategories(): Promise<Category[]> {
  return fetchJson<Category[]>('/categories')
}

export async function getCategoryProducts(
  slug: string,
  params?: { page?: number; limit?: number }
): Promise<{ category: Category } & PaginatedResponse<Product>> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const query = searchParams.toString()
  return fetchJson<{ category: Category } & PaginatedResponse<Product>>(
    `/categories/${slug}${query ? `?${query}` : ''}`
  )
}

export async function createSubscription(data: {
  email: string
  productId: string
  targetPrice?: number
  notificationType: 'any_drop' | 'threshold' | 'all_time_low'
}): Promise<{ message: string; subscription: Subscription }> {
  return fetchJson<{ message: string; subscription: Subscription }>(
    '/subscriptions',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  )
}

export async function deleteSubscription(id: string): Promise<{ message: string }> {
  return fetchJson<{ message: string }>(`/subscriptions/${id}`, {
    method: 'DELETE',
  })
}
