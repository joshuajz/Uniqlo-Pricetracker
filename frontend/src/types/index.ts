export interface Product {
  id: string
  name: string
  gender: 'M' | 'W' | 'U'
  category: string
  price: number
  regular: number
  lowest: number
  hue: number
}

export type SortKey = 'discount' | 'price' | 'name' | 'atl'

export type TabKey = 'all' | 'sale' | 'atl'
