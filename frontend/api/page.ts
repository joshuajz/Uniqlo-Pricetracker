import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { pageMetadata, renderMetadata } from '../src/lib/metadata.ts'

export async function renderPage(path: string, template: string, apiURL: string | undefined, fetcher = fetch) {
  let metadata = pageMetadata(path)
  let status = metadata.noindex ? 404 : 200
  if (/^\/products\/[^/]+$/.test(path)) {
    if (!apiURL || !/^https?:\/\//.test(apiURL)) {
      status = 503
    } else {
      try {
        const id = decodeURIComponent(path.slice('/products/'.length))
        const response = await fetcher(`${apiURL.replace(/\/$/, '')}/product/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(5000) })
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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const requestURL = new URL(req.url ?? '/', 'http://localhost')
  const path = requestURL.searchParams.get('path') ?? requestURL.pathname
  const template = await readFile(join(process.cwd(), 'dist', 'index.html'), 'utf8')
  const { status, html } = await renderPage(path, template, process.env.VITE_API_URL)
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', status === 200 ? 'public, max-age=0, s-maxage=300' : 'no-store')
  res.end(html)
}
