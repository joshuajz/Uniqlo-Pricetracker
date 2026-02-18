import { useQuery } from "@tanstack/react-query"

const API_URL = import.meta.env.VITE_API_URL || '/api'

export const getProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => fetch(`${API_URL}/products`).then(res => res.json()),
    staleTime: 1000 * 60 * 5, // 5 mins
  })
}
