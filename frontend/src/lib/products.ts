import type { Product, ProductDatapoint, ProductDetail } from '../types/types.ts'

export const DAY = 86_400_000
export const PAGE_SIZE = 24
export type Department = 'all' | 'women' | 'men' | 'kids'
export type ProductSort = 'discount' | 'price' | 'name'
export interface BrowseFilters {
  query: string
  department: Department
  category: string
  lowestOnly: boolean
  sort: ProductSort
  view: 'list' | 'grid'
  limit: number
}

export const money = (value: number) => new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD',
}).format(value)
export const isOnSale = (p: Product) => p.price < p.regular_price
// Match the API: a new product at its typical price is not a historical-low deal.
export const isLowestRecorded = (p: Product) => p.price <= p.lowest_price && p.lowest_price < p.regular_price
export const discountPct = (p: Product) => p.regular_price > 0
  ? Math.max(0, Math.round((1 - p.price / p.regular_price) * 100)) : 0
export const categoryLabel = (slug: string) => slug.replace(/-/g, ' ').replace(/^./, s => s.toUpperCase())
export const departmentsLabel = (p: Product) => [...new Set(p.categories.map(c => c.split('/')[0]))]
  .map(categoryLabel).join(' & ') || 'Uncategorized'
export const departmentHasCategory = (products: Product[], department: Department, category: string) =>
  category === 'all' || department === 'all' || products.some(p => p.categories.some(slug => {
    const [productDepartment, ...productCategory] = slug.split('/')
    return productDepartment === department && productCategory.join('/') === category
  }))

// The API stores calendar dates, not instants in the viewer's timezone.
export const recordingTime = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`)
export function formatRecordingDate(date: string | null | undefined, year = true) {
  if (!date || !Number.isFinite(recordingTime(date))) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short', day: 'numeric', ...(year ? { year: 'numeric' as const } : {}), timeZone: 'UTC',
  }).format(recordingTime(date))
}
export function recordingAge(date: string | null | undefined, now = Date.now()) {
  return date ? Math.max(0, Math.floor((now - recordingTime(date)) / DAY)) : 0
}

export function readBrowseFilters(params: URLSearchParams): BrowseFilters {
  const legacy = params.get('open')?.split('/') ?? []
  const department = params.get('department') ?? legacy[0] ?? 'all'
  const sort = params.get('sort')
  const limit = Number(params.get('limit'))
  return {
    query: params.get('q') ?? '',
    department: (['all', 'women', 'men', 'kids'].includes(department) ? department : 'all') as Department,
    category: (params.get('category') ?? legacy.slice(1).join('/')) || 'all',
    lowestOnly: params.get('lowest') === '1' || sort === 'atl',
    sort: sort === 'price' || sort === 'name' ? sort : 'discount',
    view: params.get('view') === 'list' ? 'list' : 'grid',
    limit: Number.isSafeInteger(limit) && limit >= PAGE_SIZE ? Math.min(limit, 10000) : PAGE_SIZE,
  }
}

export function filterProducts(products: Product[], filters: BrowseFilters, dealsOnly: boolean) {
  const query = filters.query.trim().toLowerCase()
  const unique = [...new Map(products.map(p => [p.product_id, p])).values()]
  return unique.filter(p => (!dealsOnly || isOnSale(p))
    && (!filters.lowestOnly || isLowestRecorded(p))
    && (!query || p.name.toLowerCase().includes(query) || p.product_id.toLowerCase().includes(query))
    && ((filters.department === 'all' && filters.category === 'all') || p.categories.some(slug => {
      const [department, ...category] = slug.split('/')
      return (filters.department === 'all' || department === filters.department)
        && (filters.category === 'all' || category.join('/') === filters.category)
    })))
    .sort((a, b) => {
      const difference = filters.sort === 'price' ? a.price - b.price
        : filters.sort === 'name' ? a.name.localeCompare(b.name)
        : discountPct(b) - discountPct(a)
      return difference || a.name.localeCompare(b.name) || a.product_id.localeCompare(b.product_id)
    })
}

export function productFromDetail(detail: ProductDetail): Product {
  const sorted = [...detail.datapoints].sort((a, b) => recordingTime(a.datetime) - recordingTime(b.datetime))
  const latest = sorted[sorted.length - 1]
  return {
    product_id: detail.product_id, name: detail.name, price: detail.current_price,
    url: detail.url, categories: latest?.categories ?? [], datetime: latest?.datetime ?? '',
    regular_price: detail.regular_price, lowest_price: detail.lowest_price.lowest_price,
    is_all_time_low: detail.is_all_time_low,
  }
}

export function recordedHistory(datapoints: ProductDatapoint[]) {
  return [...new Map(datapoints.filter(d => Number.isFinite(recordingTime(d.datetime)) && Number.isFinite(d.price))
    .map(d => [recordingTime(d.datetime), { time: recordingTime(d.datetime), price: d.price }])).values()]
    .sort((a, b) => a.time - b.time)
}

export function chartHistory(datapoints: ProductDatapoint[]) {
  const observations = recordedHistory(datapoints)
  const series: { time: number; price: number | null }[] = []
  observations.forEach((point, i) => {
    const previous = observations[i - 1]
    if (previous && point.time - previous.time > DAY) series.push({ time: previous.time + DAY, price: null })
    series.push(point)
  })
  return series
}
