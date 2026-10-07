import type { Product, ProductAttributes, ProductDatapoint, ProductDetail } from '../types/types.ts'

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

export { money } from './markets.ts'
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

// Normalize compatibility forms (including half-width kana and full-width Latin)
// without changing the names displayed to customers.
export const normalizeProductText = (text: string) => text.replace(/[™®℠]/g, '').normalize('NFKC').toLowerCase()
  .replace(/[‐‑‒–—−]/g, '-').replace(/\s+/g, ' ').trim()

const PRODUCT_FACETS: Array<ProductFacet & { id: string; aliases: string[]; terms: RegExp }> = [
  { id: 'cotton', group: 'Material', label: 'Cotton', aliases: ['コットン', '綿'], terms: /(?<![a-z0-9])cotton(?![a-z0-9])|コットン|綿/ },
  { id: 'denim', group: 'Material', label: 'Denim', aliases: ['jeans', 'デニム', 'ジーンズ'], terms: /(?<![a-z0-9])(?:denim|jeans?)(?![a-z0-9])|デニム|ジーンズ/ },
  { id: 'linen', group: 'Material', label: 'Linen', aliases: ['リネン', '麻'], terms: /(?<![a-z0-9])linen(?![a-z0-9])|リネン|麻/ },
  { id: 'merino-wool', group: 'Material', label: 'Merino wool', aliases: ['merino', 'メリノ'], terms: /(?<![a-z0-9])merino(?![a-z0-9])|メリノ/ },
  { id: 'wool', group: 'Material', label: 'Wool', aliases: ['ウール', '羊毛'], terms: /(?<![a-z0-9])(?:wool|merino)(?![a-z0-9])|ウール|羊毛|メリノ/ },
  { id: 'cashmere', group: 'Material', label: 'Cashmere', aliases: ['カシミヤ', 'カシミア'], terms: /(?<![a-z0-9])cashmere(?![a-z0-9])|カシミ[ヤア]/ },
  { id: 'fleece', group: 'Material', label: 'Fleece', aliases: ['フリース'], terms: /(?<![a-z0-9])fleece(?![a-z0-9])|フリース/ },
  { id: 'airism', group: 'Feature', label: 'AIRism', aliases: ['air ism', 'air-ism', 'エアリズム'], terms: /(?<![a-z0-9])air[ -]?ism(?![a-z0-9])|エアリズム/ },
  { id: 'heattech', group: 'Feature', label: 'HEATTECH', aliases: ['heat tech', 'heat-tech', 'ヒートテック'], terms: /(?<![a-z0-9])heat[ -]?tech(?![a-z0-9])|ヒートテック/ },
  { id: 'pufftech', group: 'Feature', label: 'PUFFTECH', aliases: ['puff tech', 'puff-tech', 'パフテック'], terms: /(?<![a-z0-9])puff[ -]?tech(?![a-z0-9])|パフテック/ },
  { id: 'uv-protection', group: 'Feature', label: 'UV protection', aliases: ['uv cut', 'uv-cut', 'uvcut', 'UVカット'], terms: /(?<![a-z0-9])uv[ -]?(?:protection|cut)(?![a-z0-9])|uvカット/ },
  { id: 'ultra-light-down', group: 'Feature', label: 'Ultra light down', aliases: ['ウルトラライトダウン'], terms: /(?<![a-z0-9])ultra[ -]light[ -]down(?![a-z0-9])|ウルトラライトダウン/ },
  { id: 'blocktech', group: 'Feature', label: 'BLOCKTECH', aliases: ['block tech', 'block-tech', 'ブロックテック'], terms: /(?<![a-z0-9])block[ -]?tech(?![a-z0-9])|ブロックテック/ },
  { id: 'stretch', group: 'Feature', label: 'Stretch', aliases: ['ストレッチ'], terms: /(?<![a-z0-9])stretch(?![a-z0-9])|ストレッチ/ },
  { id: 'washable', group: 'Feature', label: 'Washable', aliases: ['ウォッシャブル', '洗える'], terms: /(?<![a-z0-9])washable(?![a-z0-9])|ウォッシャブル|洗える/ },
  { id: 'quick-dry', group: 'Feature', label: 'Quick dry', aliases: ['quick-dry', 'dry-ex', 'dry ex', 'dryex', 'ドライEX', 'ドライ-EX', 'ドライ EX', '速乾'], terms: /(?<![a-z0-9])(?:quick[ -]dry|dry[ -]?ex)(?![a-z0-9])|ドライ[ -]?ex|速乾/ },
]

// Resolve only complete aliases: 'cot' must not select the Cotton filter.
const canonicalFacetLabel = (value: string) => {
  const normalized = normalizeProductText(value)
  return PRODUCT_FACETS.find(facet => [facet.id, facet.label, ...facet.aliases]
    .some(alias => normalizeProductText(alias) === normalized))?.label ?? value
}

const attributeKey = (group: ProductFacetGroup) => group === 'Material' ? 'materials' : 'features'

// Derive canonical attributes from names and attribute-specific category routes
// for existing records, and accept explicit attributes when supplied by the API.
export function productAttributes(product: Pick<Product, 'name' | 'attributes'> & Partial<Pick<Product, 'categories'>>): ProductAttributes {
  const name = normalizeProductText(product.name)
  const categoryIds = new Set(product.categories?.map(path => path.split('/').slice(-1)[0]))
  const attributes: ProductAttributes = { materials: [], features: [] }
  for (const facet of PRODUCT_FACETS) {
    const key = attributeKey(facet.group)
    if (product.attributes?.[key]?.includes(facet.id) || categoryIds.has(facet.id) || facet.terms.test(name)) {
      attributes[key].push(facet.id)
    }
  }
  return attributes
}

export const normalizeProduct = (product: Product): Product => ({
  ...product, attributes: productAttributes(product),
})

const facetsFromAttributes = (attributes: ProductAttributes) => PRODUCT_FACETS
  .filter(facet => attributes[attributeKey(facet.group)].includes(facet.id))

export const productFacets = (product: Product): ProductFacet[] => facetsFromAttributes(productAttributes(product))
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
    tags: [...new Set(params.getAll('tag').filter(value => value && value !== 'all').map(canonicalFacetLabel))],
    lowestOnly: params.get('lowest') === '1' || sort === 'atl',
    sort: sort === 'discount' || sort === 'price' || sort === 'name' ? sort : defaultSort,
    view: params.get('view') === 'list' ? 'list' : 'grid',
    limit: Number.isSafeInteger(limit) && limit >= PAGE_SIZE ? Math.min(limit, 10000) : PAGE_SIZE,
  }
}

export function filterProducts(products: Product[], filters: BrowseFilters, dealsOnly: boolean) {
  const queryTerms = normalizeProductText(filters.query).split(' ').filter(Boolean)
  const unique = [...new Map(products.map(p => [p.product_id, p])).values()]
  const selectedFacetGroups = new Map<ProductFacetGroup, string[]>()
  const selectedLabels = new Set(filters.tags.map(canonicalFacetLabel))
  for (const facet of PRODUCT_FACETS.filter(item => selectedLabels.has(item.label))) {
    selectedFacetGroups.set(facet.group, [...(selectedFacetGroups.get(facet.group) ?? []), facet.label])
  }
  return unique.filter(p => {
    const facets = facetsFromAttributes(productAttributes(p))
    const searchTerms = [p.name, p.product_id, ...facets.flatMap(facet => [facet.id, facet.label, ...facet.aliases])]
      .map(normalizeProductText)
    return (!dealsOnly || isOnSale(p))
      && (!filters.lowestOnly || isLowestRecorded(p))
      && [...selectedFacetGroups].every(([group, labels]) => facets
        .some(facet => facet.group === group && labels.includes(facet.label)))
      && queryTerms.every(term => searchTerms.some(value => value.includes(term)))
      && ((filters.department === 'all' && filters.categories.length === 0) || p.categories.some(slug => {
        const [department, ...category] = slug.split('/')
        return (filters.department === 'all' || department === filters.department)
          && (filters.categories.length === 0 || filters.categories.includes(category.join('/')))
      }))
  })
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
  return normalizeProduct({
    product_id: detail.product_id, name: detail.name, price: detail.current_price,
    url: detail.url, categories: latest?.categories ?? [], datetime: latest?.datetime ?? '',
    regular_price: detail.regular_price, lowest_price: detail.lowest_price.lowest_price,
    is_all_time_low: detail.is_all_time_low,
    attributes: detail.attributes,
  })
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
