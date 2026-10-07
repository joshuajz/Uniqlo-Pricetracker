import { productLinkFromPath } from '../src/lib/product-links.ts'
import { DEFAULT_MARKET, legacyDestination, marketPath, money, splitMarketPath, type Market } from '../src/lib/markets.ts'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { escapeHTML, pageMetadata, renderMetadata } from '../src/lib/metadata.ts'

export async function renderPage(path: string, template: string, apiURL: string | undefined, fetcher = fetch) {
  let content = ''
  let metadata = pageMetadata(path)
  let status = metadata.noindex && splitMarketPath(path).path !== '/saved' ? 404 : 200
  const resolved = splitMarketPath(path)
  if (/^\/products\/[^/]+$/.test(resolved.path)) {
    if (!apiURL || !/^https?:\/\//.test(apiURL)) {
      status = 503
    } else {
      try {
        const id = decodeURIComponent(resolved.path.slice('/products/'.length))
        const response = await fetcher(`${apiURL.replace(/\/$/, '')}/${(resolved.market ?? DEFAULT_MARKET).slug}/product/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(5000) })
        if (response.status === 404) { metadata = pageMetadata(path, undefined, true); status = 404 }
        else if (!response.ok) status = 503
        else {
          const detail = await response.json()
          if (typeof detail.name !== 'string' || !Number.isFinite(detail.current_price)) throw new Error('Invalid product response')
          metadata = pageMetadata(path, { product_id: id, name: detail.name, price: detail.current_price })
          content = renderProductContent(id, detail, resolved.market ?? DEFAULT_MARKET)
        }
      } catch { status = 503 }
    }
  }
  const html = renderMetadata(template, metadata)
  // createRoot replaces this readable fallback when the interactive app mounts.
  return { status, html: content ? html.replace('<div id="root"></div>', () => `<div id="root">${content}</div>`) : html }
}

interface RecordedProduct {
  name: string
  current_price: number
  regular_price?: number
  lowest_price?: { lowest_price: number }
  url?: string
  datapoints?: { datetime: string }[]
}

function renderProductContent(id: string, detail: RecordedProduct, market: Market) {
  const price = (value: number) => escapeHTML(`${money(value, market)} ${market.currency}`)
  const facts = [`<div><dt>Last recorded price</dt><dd>${price(detail.current_price)}</dd></div>`]
  if (Number.isFinite(detail.regular_price)) facts.push(`<div><dt>Typical tracked price</dt><dd>${price(detail.regular_price!)}</dd></div>`)
  if (Number.isFinite(detail.lowest_price?.lowest_price)) facts.push(`<div><dt>Lowest recorded price</dt><dd>${price(detail.lowest_price!.lowest_price)}</dd></div>`)
  const dates = Array.isArray(detail.datapoints) ? detail.datapoints
    .map(point => point?.datetime).filter(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(date) && Number.isFinite(Date.parse(date))).sort() : []
  for (const [label, date] of [['Last checked', dates.at(-1)], ['Tracking since', dates[0]]]) {
    if (date) facts.push(`<div><dt>${label}</dt><dd><time datetime="${escapeHTML(date)}">${escapeHTML(date.slice(0, 10))}</time></dd></div>`)
  }
  let storeLink = ''
  try {
    const url = new URL(detail.url ?? '')
    if (url.protocol === 'https:' && (url.hostname === 'uniqlo.com' || url.hostname.endsWith('.uniqlo.com'))) {
      storeLink = `<p><a href="${escapeHTML(url.href)}" rel="noopener noreferrer">Check sizes and availability on Uniqlo</a></p>`
    }
  } catch { /* A missing store URL does not hide recorded facts. */ }
  return `<main class="product-detail-page page-container"><nav aria-label="Breadcrumb"><a href="${marketPath(market, '/categories')}">All products in ${market.name}</a></nav><article><h1>${escapeHTML(detail.name)}</h1><p>${escapeHTML(id)}</p><h2>Recorded Uniqlo ${market.name} price history</h2><dl>${facts.join('')}</dl><p>These are recorded prices; confirm the current price and availability on Uniqlo.</p>${storeLink}<p><a href="${marketPath(market, '/faq#price-comparisons')}">How prices are compared</a></p></article></main>`
}

export function redirectPath(path: string) {
  const retailerLink = productLinkFromPath(path)
  if (retailerLink) return retailerLink.historyPath
  const resolved = splitMarketPath(path)
  if (resolved.market) {
    const canonical = marketPath(resolved.market, resolved.path === '/dashboard' ? '/' : resolved.path)
    return canonical === path ? undefined : canonical
  }
  if (['/categories', '/dashboard', '/saved', '/faq', '/terms', '/privacy'].includes(path) || /^\/products\/[^/]+$/.test(path)) {
    return legacyDestination(path)
  }
  // The home page needs browser storage to choose a country.
  return undefined
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const requestURL = new URL(req.url ?? '/', 'http://localhost')
  const path = requestURL.searchParams.get('path') ?? requestURL.pathname
  const redirect = redirectPath(path)
  if (redirect) {
    requestURL.searchParams.delete('path')
    const query = requestURL.searchParams.toString()
    res.statusCode = 308
    res.setHeader('Location', redirect + (query ? `?${query}` : ''))
    res.end()
    return
  }
  const template = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
  const { status, html } = await renderPage(path, template, process.env.VITE_API_URL)
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', status === 200 ? 'public, max-age=0, s-maxage=300' : 'no-store')
  res.end(html)
}
