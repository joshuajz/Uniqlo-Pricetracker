import type { IncomingMessage, ServerResponse } from 'node:http'
import { MARKETS, marketPath, type Market } from '../src/lib/markets.ts'
import { SITE_URL, escapeHTML } from '../src/lib/metadata.ts'

// Below the protocol's 50,000 URL and 50 MB limits, even for long IDs.
export const SITEMAP_PAGE_SIZE = 10000
const xml = (tag: string, entries: string[]) => `<?xml version="1.0" encoding="UTF-8"?>\n<${tag} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</${tag}>`
const sitemapPath = (market: Market, page: number) => `/sitemap-products-${market.slug}-${page}.xml`

async function productIDs(market: Market, apiURL: string, fetcher: typeof fetch) {
  const response = await fetcher(`${apiURL.replace(/\/$/, '')}/${market.slug}/products`, { signal: AbortSignal.timeout(5000) })
  if (!response.ok) throw new Error('Catalogue unavailable')
  const data = await response.json()
  if (!Array.isArray(data.products)) throw new Error('Invalid catalogue')
  const ids = data.products.map((product: { product_id?: unknown }) => {
    if (!product || typeof product.product_id !== 'string' || !product.product_id || product.product_id.length > 256 || /[\s/\x00-\x1f\x7f]/.test(product.product_id) || ['.', '..'].includes(product.product_id)) {
      throw new Error('Invalid product ID')
    }
    return product.product_id
  })
  return [...new Set<string>(ids)].sort()
}

export async function renderSitemap(path: string, apiURL: string | undefined, fetcher = fetch) {
  const match = /^\/sitemap-products-(ca|us|uk|jp)-([1-9]\d*)\.xml$/.exec(path)
  if (path !== '/sitemap.xml' && !match) return { status: 404, body: 'Sitemap not found' }
  if (!apiURL || !/^https?:\/\//.test(apiURL)) return { status: 503, body: 'Sitemap temporarily unavailable' }
  try {
    if (!match) {
      const catalogues = await Promise.all(MARKETS.map(async market => ({ market, ids: await productIDs(market, apiURL, fetcher) })))
      const paths = ['/sitemap-pages.xml', ...catalogues.flatMap(({ market, ids }) =>
        Array.from({ length: Math.ceil(ids.length / SITEMAP_PAGE_SIZE) }, (_, index) => sitemapPath(market, index + 1)))]
      return { status: 200, body: xml('sitemapindex', paths.map(path => `<sitemap><loc>${SITE_URL}${path}</loc></sitemap>`)) }
    }
    const market = MARKETS.find(market => market.slug === match[1])!
    const ids = await productIDs(market, apiURL, fetcher)
    const page = Number(match[2])
    if (!Number.isSafeInteger(page) || page > Math.ceil(ids.length / SITEMAP_PAGE_SIZE)) return { status: 404, body: 'Sitemap not found' }
    const selected = ids.slice((page - 1) * SITEMAP_PAGE_SIZE, page * SITEMAP_PAGE_SIZE)
    return { status: 200, body: xml('urlset', selected.map(id => `<url><loc>${escapeHTML(SITE_URL + marketPath(market, `/products/${encodeURIComponent(id)}`))}</loc></url>`)) }
  } catch {
    // Never cache a partial index or turn an API outage into an empty catalogue.
    return { status: 503, body: 'Sitemap temporarily unavailable' }
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const { status, body } = await renderSitemap(url.searchParams.get('path') ?? url.pathname, process.env.VITE_API_URL)
  res.statusCode = status
  res.setHeader('Content-Type', status === 200 ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', status === 200 ? 'public, max-age=0, s-maxage=300' : 'no-store')
  res.end(body)
}
