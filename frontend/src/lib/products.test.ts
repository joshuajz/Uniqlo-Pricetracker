import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Product, ProductDetail } from '../types/types.ts'
import { chartHistory, DAY, departmentHasCategory, filterProducts, formatRecordingDate, isLowestRecorded, PAGE_SIZE, productFromDetail, readBrowseFilters, recordingTime } from './products.ts'

const product = (id: string, overrides: Partial<Product> = {}): Product => ({
  product_id: id, name: id, price: 19.9, regular_price: 39.9, lowest_price: 19.9,
  is_all_time_low: true, categories: ['men/tops'], datetime: '2026-09-04T00:00:00Z', url: 'https://www.uniqlo.com/ca/en/', ...overrides,
})
const defaults = readBrowseFilters(new URLSearchParams())

test('grid is the default view and list remains an explicit URL preference', () => {
  assert.equal(defaults.view, 'grid')
  assert.equal(readBrowseFilters(new URLSearchParams('view=list')).view, 'list')
})

test('an unmatched query returns no groups or products, and IDs are case-insensitive', () => {
  const data = [product('E123-000', { name: 'AIRism T-Shirt' })]
  assert.deepEqual(filterProducts(data, { ...defaults, query: 'zzzz-no-match' }, true), [])
  assert.equal(filterProducts(data, { ...defaults, query: ' e123 ' }, true).length, 1)
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
  assert.equal(filterProducts([cross], { ...defaults, department: 'men', category: 'bottoms' }, true).length, 0)
  assert.equal(filterProducts([cross], { ...defaults, department: 'women', category: 'bottoms' }, true).length, 1)
  assert.equal(filterProducts([product('uncategorized', { categories: [] })], defaults, false).length, 1)
})

test('a category selection can carry between departments only when it exists there', () => {
  const data = [product('men-bottoms', { categories: ['men/bottoms'] }), product('women-bottoms', { categories: ['women/bottoms'] })]
  assert.equal(departmentHasCategory(data, 'women', 'bottoms'), true)
  assert.equal(departmentHasCategory(data, 'kids', 'bottoms'), false)
  assert.equal(departmentHasCategory(data, 'kids', 'all'), true)
})

test('lowest-recorded eligibility excludes a new full-price observation everywhere', () => {
  const fresh = product('fresh', { price: 39.9, lowest_price: 39.9, is_all_time_low: false })
  const low = product('low')
  assert.equal(isLowestRecorded(fresh), false)
  assert.equal(isLowestRecorded(low), true)
  assert.deepEqual(filterProducts([fresh, low], { ...defaults, lowestOnly: true }, false).map(p => p.product_id), ['low'])
})

test('legacy category and ATL links map to active filters; malformed options are bounded', () => {
  const filters = readBrowseFilters(new URLSearchParams('open=men%2Fbottoms&sort=atl&limit=-9'))
  assert.equal(filters.department, 'men')
  assert.equal(filters.category, 'bottoms')
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
