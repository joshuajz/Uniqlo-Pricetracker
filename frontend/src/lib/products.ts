import type { Product, ProductDatapoint, ProductDetail } from '../types/types.ts'

export const DAY = 86_400_000
export const PAGE_SIZE = 24
export const DEPARTMENTS = ['all', 'women', 'men', 'kids', 'baby'] as const
export type Department = typeof DEPARTMENTS[number]
export type ProductSort = 'discount' | 'price' | 'name'
export interface BrowseFilters {
  query: string
  department: Department
  categories: string[]
  tags: string[]
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
const CATEGORY_LABELS: Record<string, string> = {
  'baby-6-18-months': 'Newborn',
  newborn2: 'Newborn',
  flower: 'Flowers',
  'uv-protection': 'UV protection',
}
export const categoryLabel = (slug: string) => CATEGORY_LABELS[slug]
  ?? slug.replace(/-/g, ' ').replace(/^./, s => s.toUpperCase())
export type ProductFacetGroup = 'Material' | 'Feature'
export interface ProductFacet { group: ProductFacetGroup; label: string }

const PRODUCT_FACETS: Array<ProductFacet & { terms: RegExp }> = [
  { group: 'Material', label: 'Cotton', terms: /\bcotton\b/i },
  { group: 'Material', label: 'Denim', terms: /\bdenim\b|\bjeans?\b/i },
  { group: 'Material', label: 'Linen', terms: /\blinen\b/i },
  { group: 'Material', label: 'Merino wool', terms: /\bmerino\b/i },
  { group: 'Material', label: 'Wool', terms: /\bwool\b/i },
  { group: 'Material', label: 'Cashmere', terms: /\bcashmere\b/i },
  { group: 'Material', label: 'Fleece', terms: /\bfleece\b/i },
  { group: 'Feature', label: 'AIRism', terms: /\bairism\b/i },
  { group: 'Feature', label: 'HEATTECH', terms: /\bheattech\b/i },
  { group: 'Feature', label: 'PUFFTECH', terms: /\bpufftech\b/i },
  { group: 'Feature', label: 'UV protection', terms: /\buv protection\b/i },
  { group: 'Feature', label: 'Ultra light down', terms: /\bultra light down\b/i },
  { group: 'Feature', label: 'BLOCKTECH', terms: /\bblocktech\b/i },
  { group: 'Feature', label: 'Stretch', terms: /\bstretch\b/i },
  { group: 'Feature', label: 'Washable', terms: /\bwashable\b/i },
  { group: 'Feature', label: 'Quick dry', terms: /\bquick dry\b|\bdry-ex\b/i },
]

export const productFacets = (product: Product) => PRODUCT_FACETS
  .filter(facet => facet.terms.test(product.name))
  .map(({ group, label }) => ({ group, label }))

export const productCategory = (product: Product) => {
  const path = product.categories[0]?.split('/').slice(1).join('/')
  return path ? categoryLabel(path) : 'Uncategorized'
}
export interface CategoryFilterPresentation { key: string; label: string; values: string[] }
const CATEGORY_FILTER_PRESENTATIONS: CategoryFilterPresentation[] = [
  { key: 'newborn', label: 'Newborn', values: ['baby-6-18-months', 'newborn', 'newborn2'] },
  { key: 'accessories-and-home', label: 'Accessories and home', values: ['accessories', 'accessories-and-home'] },
  { key: 'formal-and-polo-shirts', label: 'Formal and polo shirts', values: ['shirts-and-polo-shirts'] },
  { key: 'knitwear', label: 'Knitwear', values: [
    'shirts-and-knitwear', 'shirts-and-knitware', 'sweaters-and-knitwear', 'sweaters-and-knitware',
  ] },
]
export function categoryFilterPresentation(category: string): CategoryFilterPresentation {
  return CATEGORY_FILTER_PRESENTATIONS.find(option => option.values.includes(category))
    ?? { key: category, label: categoryLabel(category), values: [category] }
}
const DEPARTMENT_ORDER: Record<string, number> = { women: 0, men: 1, kids: 2, baby: 3 }
export const departmentsLabel = (p: Product) => [...new Set(p.categories.map(c => c.split('/')[0]))]
  .sort((a, b) => (DEPARTMENT_ORDER[a] ?? 99) - (DEPARTMENT_ORDER[b] ?? 99) || a.localeCompare(b))
  .map(categoryLabel).join(' & ') || 'Uncategorized'
export const departmentHasCategory = (products: Product[], department: Department, categories: string[]) =>
  categories.length === 0 || department === 'all' || products.some(p => p.categories.some(slug => {
    const [productDepartment, ...productCategory] = slug.split('/')
    return productDepartment === department && categories.includes(productCategory.join('/'))
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
  return date ? Math.max(0, Math.floor((now - recordingTime(date)) / DAY)) : NaN
}

export function recordingStatus(date: string | null | undefined, now = Date.now()) {
  if (!date || !Number.isFinite(recordingTime(date))) return 'Recording date unavailable'
  const today = recordingTime(new Date(now).toISOString())
  const day = recordingTime(date)
  if (day === today) return 'Prices checked today'
  if (day === today - DAY) return 'Prices checked yesterday'
  return 'Latest prices loaded'
}

export function readBrowseFilters(params: URLSearchParams, defaultSort: ProductSort = 'discount'): BrowseFilters {
  const legacy = params.get('open')?.split('/') ?? []
  const department = params.get('department') ?? legacy[0] ?? 'all'
  const sort = params.get('sort')
  const limit = Number(params.get('limit'))
  const categories = params.getAll('category').filter(value => value && value !== 'all')
  if (categories.length === 0 && legacy.length > 1) categories.push(legacy.slice(1).join('/'))
  return {
    query: params.get('q') ?? '',
    department: DEPARTMENTS.find(option => option === department) ?? 'all',
    categories: [...new Set(categories)],
    tags: [...new Set(params.getAll('tag').filter(value => value && value !== 'all'))],
    lowestOnly: params.get('lowest') === '1' || sort === 'atl',
    sort: sort === 'discount' || sort === 'price' || sort === 'name' ? sort : defaultSort,
    view: params.get('view') === 'list' ? 'list' : 'grid',
    limit: Number.isSafeInteger(limit) && limit >= PAGE_SIZE ? Math.min(limit, 10000) : PAGE_SIZE,
  }
}

export function filterProducts(products: Product[], filters: BrowseFilters, dealsOnly: boolean) {
  const query = filters.query.trim().toLowerCase()
  const unique = [...new Map(products.map(p => [p.product_id, p])).values()]
  const selectedFacetGroups = new Map<ProductFacetGroup, string[]>()
  for (const facet of PRODUCT_FACETS.filter(item => filters.tags.includes(item.label))) {
    selectedFacetGroups.set(facet.group, [...(selectedFacetGroups.get(facet.group) ?? []), facet.label])
  }
  return unique.filter(p => (!dealsOnly || isOnSale(p))
    && (!filters.lowestOnly || isLowestRecorded(p))
    && [...selectedFacetGroups].every(([group, labels]) => productFacets(p)
      .some(facet => facet.group === group && labels.includes(facet.label)))
    && (!query || p.name.toLowerCase().includes(query) || p.product_id.toLowerCase().includes(query)
      || productFacets(p).some(facet => facet.label.toLowerCase().includes(query)))
    && ((filters.department === 'all' && filters.categories.length === 0) || p.categories.some(slug => {
      const [department, ...category] = slug.split('/')
      return (filters.department === 'all' || department === filters.department)
        && (filters.categories.length === 0 || filters.categories.includes(category.join('/')))
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
