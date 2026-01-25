// Product from /api/products list endpoint
export interface Product {
  product_id: string
  name: string
  price: number
  url: string
  category: string
  datetime: string
  lowest_price: number
  regular_price: number
  is_all_time_low: boolean
}

// Response from /api/products
export interface ProductsResponse {
  datetime: string
  count: number
  products: Product[]
}

// Response from /api/category/:category
export interface CategoryResponse {
  datetime: string
  category: string
  count: number
  products: Product[]
}

// Price datapoint from /api/product/:id
export interface PriceDatapoint {
  price: number
  category: string
  datetime: string
}

// Price info with datetime
export interface PriceInfo {
  lowest_price?: number
  lowest_price_datetime?: string
  highest_price?: number
  highest_price_datetime?: string
}

// Response from /api/product/:id
export interface ProductDetail {
  product_id: string
  name: string
  url: string
  datapoints: PriceDatapoint[]
  lowest_price: PriceInfo
  highest_price: PriceInfo
  regular_price: number
  current_price: number
  on_sale: boolean
  is_all_time_low: boolean
}
