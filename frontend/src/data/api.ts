import { useQuery } from "@tanstack/react-query"

const API_URL = import.meta.env.VITE_API_URL || '/api'

export const getProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/products`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
    staleTime: 1000 * 60 * 5, // 5 mins
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000), // 1s, 2s, 4s, 8s, 15s
  })
}

const retryConfig = {
  retry: 5,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 15000), // 1s, 2s, 4s, 8s, 15s
}

export const getCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/categories`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
    staleTime: 1000 * 60 * 5, // 5 mins
    ...retryConfig,
  })
}

export const getProductDetail = (product_id: string) => {
  return useQuery({
    queryKey: ['product', product_id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/product/${product_id}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
    staleTime: 1000 * 60 * 5,
    retry: 3,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 8000),
  })
}

export const getImage = (product_id: string, { enabled = true }: { enabled?: boolean } = {}) => {
  return useQuery({
    queryKey: ['image', product_id],
    queryFn: () => fetch(`${API_URL}/product/${product_id}/image`).then(res => res.blob()).then(blob => URL.createObjectURL(blob)),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 4000),
  })
}
