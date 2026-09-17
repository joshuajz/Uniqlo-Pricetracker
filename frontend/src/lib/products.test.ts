import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Product, ProductDetail } from '../types/types.ts'
import { categoryFilterPresentation, chartHistory, DAY, departmentHasCategory, departmentsLabel, filterProducts, formatRecordingDate, isLowestRecorded, PAGE_SIZE, productFacets, productFromDetail, readBrowseFilters, recordingTime } from './products.ts'

const product = (id: string, overrides: Partial<Product> = {}): Product => ({
  product_id: id, name: id, price: 19.9, regular_price: 39.9, lowest_price: 19.9,
  is_all_time_low: true, categories: ['men/tops'], datetime: '2026-09-04T00:00:00Z', url: 'https://www.uniqlo.com/ca/en/', ...overrides,
})
const defaults = readBrowseFilters(new URLSearchParams())

test('grid is the default view and list remains an explicit URL preference', () => {
  assert.equal(defaults.view, 'grid')
  assert.equal(readBrowseFilters(new URLSearchParams('view=list')).view, 'list')
  assert.equal(readBrowseFilters(new URLSearchParams(), 'name').sort, 'name')
  assert.equal(readBrowseFilters(new URLSearchParams('sort=discount'), 'name').sort, 'discount')
})

test('an unmatched query returns no groups or products, and IDs are case-insensitive', () => {
  const data = [product('E123-000', { name: 'AIRism T-Shirt' })]
  assert.deepEqual(filterProducts(data, { ...defaults, query: 'zzzz-no-match' }, true), [])
  assert.equal(filterProducts(data, { ...defaults, query: ' e123 ' }, true).length, 1)
})

test('product facets are derived from collected names and can filter the catalogue', () => {
  const airism = product('airism', { name: 'AIRism Cotton Crew Neck T-Shirt' })
  const denim = product('denim', { name: 'Wide Straight Jeans' })
  assert.deepEqual(productFacets(airism), [
    { group: 'Material', label: 'Cotton' },
    { group: 'Feature', label: 'AIRism' },
  ])
  assert.deepEqual(productFacets(denim), [{ group: 'Material', label: 'Denim' }])
  assert.deepEqual(filterProducts([airism, denim], { ...defaults, tags: ['AIRism'] }, true).map(p => p.product_id), ['airism'])
  assert.deepEqual(filterProducts([airism, denim], { ...defaults, query: 'cotton' }, true).map(p => p.product_id), ['airism'])
})

test('facet selections use OR within a group and AND across groups', () => {
  const cottonStretch = product('cotton-stretch', { name: 'Cotton Stretch Shirt' })
  const cottonAirism = product('cotton-airism', { name: 'Cotton AIRism Shirt' })
  const denimStretch = product('denim-stretch', { name: 'Denim Stretch Shirt' })
  assert.deepEqual(filterProducts([cottonStretch, cottonAirism, denimStretch],
    { ...defaults, tags: ['Cotton', 'Denim'] }, true).map(p => p.product_id),
  ['cotton-airism', 'cotton-stretch', 'denim-stretch'])
  assert.deepEqual(filterProducts([cottonStretch, cottonAirism, denimStretch],
    { ...defaults, tags: ['Cotton', 'Stretch'] }, true).map(p => p.product_id), ['cotton-stretch'])
})

test('broadening the same query includes a full-price item and price sorting is global', () => {
  const full = product('full', { name: 'Shirt', price: 9.9, regular_price: 9.9, lowest_price: 9.9, is_all_time_low: false })
  const sale = product('sale', { name: 'Shirt' })
  const filters = { ...defaults, query: 'shirt', sort: 'price' as const }
  assert.deepEqual(filterProducts([sale, full], filters, true).map(p => p.product_id), ['sale'])
  assert.deepEqual(filterProducts([sale, full], filters, false).map(p => p.product_id), ['full', 'sale'])
})

test('cross-listed products appear once and department/category must match the same slug', () => {
  const cross = product('cross', { categories: ['women/bottoms', 'men/tops'] })
  assert.equal(filterProducts([cross, cross], defaults, true).length, 1)
  assert.equal(filterProducts([cross], { ...defaults, department: 'men', categories: ['bottoms'] }, true).length, 0)
  assert.equal(filterProducts([cross], { ...defaults, department: 'women', categories: ['bottoms'] }, true).length, 1)
  assert.equal(filterProducts([cross], { ...defaults, categories: ['bottoms', 'tops'] }, true).length, 1)
  assert.equal(filterProducts([product('uncategorized', { categories: [] })], defaults, false).length, 1)
})

test('department labels use one stable customer-facing order', () => {
  assert.equal(departmentsLabel(product('cross', { categories: ['men/tops', 'women/tops', 'kids/tops'] })), 'Women & Men & Kids')
  assert.equal(departmentsLabel(product('cross', { categories: ['kids/tops', 'men/tops', 'women/tops'] })), 'Women & Men & Kids')
  assert.equal(departmentsLabel(product('cross', { categories: ['baby/toddler', 'kids/tops', 'baby/newborn'] })), 'Kids & Baby')
})

test('baby department links filter newborn and toddler products without duplicate listings', () => {
  const newborn = product('newborn', { categories: ['baby/baby-6-18-months'] })
  const shared = product('shared', { categories: ['baby/baby-6-18-months', 'baby/toddler', 'kids/bottoms'] })
  const kids = product('kids', { categories: ['kids/bottoms'] })
  const data = [newborn, shared, shared, kids]
  const babyFilters = readBrowseFilters(new URLSearchParams('department=baby'))
  assert.equal(babyFilters.department, 'baby')
  assert.deepEqual(filterProducts(data, babyFilters, false).map(p => p.product_id), ['newborn', 'shared'])
  const toddlerFilters = readBrowseFilters(new URLSearchParams('open=baby%2Ftoddler'))
  assert.equal(toddlerFilters.department, 'baby')
  assert.deepEqual(filterProducts(data, toddlerFilters, false).map(p => p.product_id), ['shared'])
  assert.equal(departmentHasCategory(data, 'baby', ['bottoms']), false)
})

test('a category selection can carry between departments only when it exists there', () => {
  const data = [product('men-bottoms', { categories: ['men/bottoms'] }), product('women-bottoms', { categories: ['women/bottoms'] })]
  assert.equal(departmentHasCategory(data, 'women', ['bottoms']), true)
  assert.equal(departmentHasCategory(data, 'kids', ['bottoms']), false)
  assert.equal(departmentHasCategory(data, 'kids', []), true)
})

test('category presentation combines and renames filters without changing stored values', () => {
  assert.deepEqual(categoryFilterPresentation('accessories'), {
    key: 'accessories-and-home', label: 'Accessories and home', values: ['accessories', 'accessories-and-home'],
  })
  assert.equal(categoryFilterPresentation('shirts-and-polo-shirts').label, 'Formal and polo shirts')
  assert.deepEqual(categoryFilterPresentation('sweaters-and-knitwear').values,
    ['shirts-and-knitwear', 'shirts-and-knitware', 'sweaters-and-knitwear', 'sweaters-and-knitware'])
  for (const category of ['baby-6-18-months', 'newborn', 'newborn2']) {
    const presentation = categoryFilterPresentation(category)
    assert.equal(presentation.label, 'Newborn')
    assert.equal(presentation.values.includes(category), true)
  }
})

test('lowest-recorded eligibility excludes a new full-price observation everywhere', () => {
  const fresh = product('fresh', { price: 39.9, lowest_price: 39.9, is_all_time_low: false })
  const low = product('low')
  assert.equal(isLowestRecorded(fresh), false)
  assert.equal(isLowestRecorded(low), true)
  assert.deepEqual(filterProducts([fresh, low], { ...defaults, lowestOnly: true }, false).map(p => p.product_id), ['low'])
})

test('legacy and repeated facet links map to active filters; malformed options are bounded', () => {
  const filters = readBrowseFilters(new URLSearchParams('open=men%2Fbottoms&tag=Cotton&tag=Stretch&sort=atl&limit=-9'))
  assert.equal(filters.department, 'men')
  assert.deepEqual(filters.categories, ['bottoms'])
  assert.deepEqual(filters.tags, ['Cotton', 'Stretch'])
  assert.equal(filters.lowestOnly, true)
  assert.equal(filters.sort, 'discount')
  assert.equal(filters.limit, PAGE_SIZE)
  assert.equal(readBrowseFilters(new URLSearchParams('department=unknown&limit=999999999999')).limit, 10000)
  assert.equal(readBrowseFilters(new URLSearchParams('department=unknown')).department, 'all')
})

test('calendar dates do not shift in Toronto or Tokyo', () => {
  const previous = process.env.TZ
  try {
    for (const zone of ['America/Toronto', 'Asia/Tokyo', 'UTC']) {
      process.env.TZ = zone
      assert.equal(formatRecordingDate('2026-09-04T00:00:00Z'), 'Sep 4, 2026')
      assert.equal(recordingTime('2026-09-04T00:00:00Z'), Date.UTC(2026, 8, 4))
    }
  } finally { if (previous) process.env.TZ = previous; else delete process.env.TZ }
})

test('history preserves time gaps and handles one observation without inventing prices', () => {
  const points = ['2026-09-01', '2026-09-02', '2026-09-05'].map((day, i) => ({ datetime: `${day}T00:00:00Z`, price: 49.9 - i * 10, categories: [] }))
  const series = chartHistory(points)
  assert.equal(series.length, 4)
  assert.equal(series[2].price, null)
  assert.equal(series[3].time - series[1].time, 3 * DAY)
  assert.deepEqual(chartHistory(points.slice(0, 1)), [{ time: Date.UTC(2026, 8, 1), price: 49.9 }])
})

test('a historical product can be rendered without today’s product list', () => {
  const detail: ProductDetail = { product_id: 'archived', name: 'Archived shirt', url: 'https://www.uniqlo.com/ca/en/',
    datapoints: [{ datetime: '2026-08-20T00:00:00Z', price: 19.9, categories: ['men/tops'] }],
    lowest_price: { lowest_price: 19.9, lowest_price_datetime: '2026-08-20T00:00:00Z' },
    highest_price: { highest_price: 39.9, highest_price_datetime: '2026-05-01T00:00:00Z' },
    regular_price: 39.9, current_price: 19.9, on_sale: true, is_all_time_low: true }
  assert.equal(productFromDetail(detail).datetime, '2026-08-20T00:00:00Z')
  assert.equal(productFromDetail(detail).name, 'Archived shirt')
})
