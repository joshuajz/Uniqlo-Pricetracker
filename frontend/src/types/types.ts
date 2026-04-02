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

export interface ProductDatapoint {
  price: number
  categories: string[]
  datetime: string
}

export interface ProductDetail {
  product_id: string
  name: string
  url: string
  datapoints: ProductDatapoint[]
  lowest_price: { lowest_price: number; lowest_price_datetime: string }
  highest_price: { highest_price: number; highest_price_datetime: string }
  regular_price: number
  current_price: number
  on_sale: boolean
  is_all_time_low: boolean
}

export type SortKey = 'discount' | 'price' | 'name' | 'atl'

export type TabKey = 'all' | 'sale' | 'atl'
