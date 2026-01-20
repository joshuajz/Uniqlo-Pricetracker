export interface Product {
  id: string
  name: string
  currentPrice: number
  originalPrice: number
  lowestPrice: number
  highestPrice: number
  averagePrice: number
  lowestPriceDate: string
  highestPriceDate: string
  imageUrl: string
  productUrl: string
  category: string
  lastUpdated: string
}

export interface PricePoint {
  date: string
  price: number
}

export interface PriceHistory {
  productId: string
  history: PricePoint[]
}

export interface Category {
  slug: string
  name: string
  description: string
  productCount: number
}

export interface Stats {
  totalProducts: number
  productsOnSale: number
  averageDiscount: number
  lastScraped: string
  categoriesTracked: number
  priceDropsToday: number
  allTimeLows: number
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
}

export interface Subscription {
  id: string
  email: string
  productId: string
  targetPrice: number | null
  notificationType: 'any_drop' | 'threshold' | 'all_time_low'
  createdAt: string
}
