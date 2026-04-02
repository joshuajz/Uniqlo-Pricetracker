import { useQuery } from "@tanstack/react-query"

const API_URL = import.meta.env.VITE_API_URL || '/api'

export const getProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => fetch(`${API_URL}/products`).then(res => res.json()),
    staleTime: 1000 * 60 * 5, // 5 mins
  })
}

export const getCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => fetch(`${API_URL}/categories`).then(res => res.json()),
    staleTime: 1000 * 60 * 5, // 5 mins
  })
}

export const getProductDetail = (product_id: string) => {
  return useQuery({
    queryKey: ['product', product_id],
    queryFn: () => fetch(`${API_URL}/product/${product_id}`).then(res => res.json()),
    staleTime: 1000 * 60 * 5,
  })
}

export const getImage = (product_id: string, { enabled = true }: { enabled?: boolean } = {}) => {
  return useQuery({
    queryKey: ['image', product_id],
    queryFn: () => fetch(`${API_URL}/product/${product_id}/image`).then(res => res.blob()).then(blob => URL.createObjectURL(blob)),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled,
  })
}
