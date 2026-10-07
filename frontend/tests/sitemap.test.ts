import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import handler, { renderSitemap, SITEMAP_PAGE_SIZE } from '../api/sitemap.ts'

const api = 'https://api.example/api'
const catalogue = (ids: string[]) => Response.json({ products: ids.map(product_id => ({ product_id })) })

test('index preserves general pages and discovers all canonical regional catalogues', async () => {
  const seen: string[] = []
  const result = await renderSitemap('/sitemap.xml', api + '/', async url => {
    seen.push(String(url))
    return catalogue(['E1'])
  })
  assert.equal(result.status, 200)
  assert.ok(result.body.includes('<sitemapindex'))
  assert.ok(!result.body.includes('\\n'))
  assert.ok(result.body.includes('/sitemap-pages.xml</loc>'))
  for (const slug of ['ca', 'us', 'uk', 'jp']) {
    assert.ok(seen.includes(`${api}/${slug}/products`))
    assert.ok(result.body.includes(`/sitemap-products-${slug}-1.xml</loc>`))
  }
  assert.ok(!result.body.includes('products-gb'))
  const general = readFileSync(new URL('../public/sitemap-pages.xml', import.meta.url), 'utf8')
  assert.equal((general.match(/<url>/g) ?? []).length, 20)
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.equal(config.rewrites[0].destination, '/api/sitemap?path=/sitemap.xml')
  assert.ok(config.rewrites[1].destination.includes('/api/sitemap?path='))
  assert.ok(readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8').includes('Sitemap: https://www.uniqlotracker.com/sitemap.xml'))
})

test('regional sitemap sorts, deduplicates, and escapes canonical product URLs', async () => {
  for (const slug of ['ca', 'us', 'uk', 'jp']) {
    const result = await renderSitemap(`/sitemap-products-${slug}-1.xml`, api, async url => {
      assert.equal(url, `${api}/${slug}/products`)
      return catalogue(['E2', "E&<日本'", 'E1', 'E2'])
    })
    assert.equal(result.status, 200)
    assert.equal((result.body.match(/<url>/g) ?? []).length, 3)
    assert.ok(result.body.includes(`/${slug}/products/E%26%3C%E6%97%A5%E6%9C%AC&#39;</loc>`))
    assert.ok(result.body.indexOf('/products/E1') < result.body.indexOf('/products/E2'))
  }
})

test('large catalogues are split without losing URLs; absent pages return 404', async () => {
  const ids = Array.from({ length: SITEMAP_PAGE_SIZE + 1 }, (_, i) => `E${String(i).padStart(6, '0')}`)
  const fetcher: typeof fetch = async url => catalogue(String(url).includes('/ca/') ? ids : [])
  const index = await renderSitemap('/sitemap.xml', api, fetcher)
  assert.ok(index.body.includes('sitemap-products-ca-2.xml'))
  assert.ok(!index.body.includes('sitemap-products-us-1.xml'))
  const first = await renderSitemap('/sitemap-products-ca-1.xml', api, fetcher)
  const second = await renderSitemap('/sitemap-products-ca-2.xml', api, fetcher)
  assert.equal((first.body.match(/<url>/g) ?? []).length, SITEMAP_PAGE_SIZE)
  assert.equal((second.body.match(/<url>/g) ?? []).length, 1)
  assert.ok(!first.body.includes(ids.at(-1)!))
  assert.ok(second.body.includes(ids.at(-1)!))
  for (const path of ['/sitemap-products-ca-3.xml', '/sitemap-products-us-1.xml', '/sitemap-products-gb-1.xml', '/sitemap-products-ca-0.xml']) {
    assert.equal((await renderSitemap(path, api, fetcher)).status, 404)
  }
})

test('catalogue outages and malformed responses fail the whole index without partial XML', async () => {
  for (const fetcher of [
    async () => new Response(null, { status: 500 }),
    async () => { throw new Error('Timeout') },
    async () => Response.json({ products: null }),
    async () => catalogue(['bad/id']),
    async () => catalogue(['..']),
    async (url: unknown) => String(url).includes('/jp/') ? new Response(null, { status: 500 }) : catalogue(['E1']),
  ]) {
    const result = await renderSitemap('/sitemap.xml', api, fetcher)
    assert.equal(result.status, 503)
    assert.ok(!result.body.includes('<sitemapindex'))
  }
  assert.equal((await renderSitemap('/sitemap.xml', undefined)).status, 503)
})

test('handler sets XML and cache headers only on successful responses', async () => {
  const previousURL = process.env.VITE_API_URL
  const previousFetch = globalThis.fetch
  process.env.VITE_API_URL = api
  try {
    for (const status of [200, 503]) {
      globalThis.fetch = async () => status === 200 ? catalogue(['E1']) : new Response(null, { status: 500 })
      const headers = new Map()
      const response = { statusCode: 0, setHeader: (key: string, value: string) => headers.set(key, value), end: () => {} }
      await handler({ url: '/api/sitemap?path=/sitemap-products-ca-1.xml' } as never, response as never)
      assert.equal(response.statusCode, status)
      assert.equal(headers.get('Content-Type'), status === 200 ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8')
      assert.equal(headers.get('Cache-Control'), status === 200 ? 'public, max-age=0, s-maxage=300' : 'no-store')
    }
  } finally {
    globalThis.fetch = previousFetch
    if (previousURL === undefined) delete process.env.VITE_API_URL
    else process.env.VITE_API_URL = previousURL
  }
})
