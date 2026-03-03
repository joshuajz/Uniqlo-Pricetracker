export interface ProductsAPI {
  count: number,
  datetime: string,
  products: Product[]
}

export interface Product {
  product_id: string
  name: string
  price: number
  url: string
  categories: string[]
  datetime: string
  lowest_price: number
  regular_price: number
  is_all_time_low: boolean

  gender?: 'M' | 'W' | 'U'
}

export type SortKey = 'discount' | 'price' | 'name' | 'atl'

export type TabKey = 'all' | 'sale' | 'atl'
