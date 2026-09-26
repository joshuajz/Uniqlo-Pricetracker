import { DEFAULT_MARKET, legacyDestination, marketPath, splitMarketPath } from '../src/lib/markets.ts'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { pageMetadata, renderMetadata } from '../src/lib/metadata.ts'

export async function renderPage(path: string, template: string, apiURL: string | undefined, fetcher = fetch) {
  let metadata = pageMetadata(path)
  let status = metadata.noindex ? 404 : 200
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
        }
      } catch { status = 503 }
    }
  }
  return { status, html: renderMetadata(template, metadata) }
}

export function redirectPath(path: string) {
  const resolved = splitMarketPath(path)
  if (resolved.market) {
    const canonical = marketPath(resolved.market, resolved.path === '/dashboard' ? '/' : resolved.path)
    return canonical === path ? undefined : canonical
  }
  if (['/categories', '/dashboard', '/faq', '/terms', '/privacy'].includes(path) || /^\/products\/[^/]+$/.test(path)) {
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
