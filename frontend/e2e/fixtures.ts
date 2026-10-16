import { test as base } from '@playwright/test'

export const currentId = 'E100001-000'
export const archiveId = 'E100002-000'
const date = '2026-10-15T00:00:00Z'
const product = (id: string, archived = false, market = 'ca') => ({
  product_id: id, name: archived ? 'Archived linen shirt' : 'Cotton crew neck shirt',
  price: 19.9, regular_price: 39.9, lowest_price: 19.9, is_all_time_low: true,
  is_archived: archived, categories: ['men/tops'], datetime: archived ? '2026-09-01T00:00:00Z' : date,
  url: `https://www.uniqlo.com/${market}/en/products/${id}/00`,
})

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => localStorage.setItem('uniqlo-tracker-analytics-consent-v1', 'declined'))
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      const market = url.pathname.split('/')[2]
      const currency = market === 'jp' ? 'JPY' : market === 'uk' ? 'GBP' : market === 'us' ? 'USD' : 'CAD'
      if (url.pathname.endsWith('/image')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="120"><rect width="90" height="120" fill="#eee"/></svg>' })
      if (url.pathname.endsWith('/products')) {
        const products = [product(currentId, false, market), ...(url.searchParams.get('include_archived') === '1' ? [product(archiveId, true, market)] : [])]
        return route.fulfill({ json: { market: market.toUpperCase(), currency, datetime: date, count: products.length, products } })
      }
      const id = url.pathname.split('/').pop()
      if (id !== currentId && id !== archiveId) return route.fulfill({ status: 404, json: { error: 'Product not found' } })
      const p = product(id, id === archiveId, market)
      const end = Date.parse(p.datetime)
      const datapoints = Array.from({length:100}, (_, i) => ({
        datetime: new Date(end - (99 - i) * 86400000).toISOString(), price: i < 90 ? 39.9 : 19.9, categories: p.categories,
      }))
      return route.fulfill({ json: {
        ...p, market: market.toUpperCase(), currency, current_price: p.price, datapoints, on_sale: true,
        lowest_price: { lowest_price: 19.9, lowest_price_datetime: p.datetime },
        highest_price: { highest_price: 39.9, highest_price_datetime: datapoints[0].datetime },
      } })
    })
    await use(page)
  },
})
export { expect } from '@playwright/test'
