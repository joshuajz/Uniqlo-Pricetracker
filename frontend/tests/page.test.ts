import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { renderPage } from '../api/page.ts'

const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

test('product route returns sharing metadata before JavaScript runs', async () => {
  const fetcher: typeof fetch = async (url) => {
    assert.equal(url, 'https://api.example/api/product/E1')
    return Response.json({ name: 'Cotton Shirt', current_price: 19.9 })
  }
  const page = await renderPage('/products/E1', template, 'https://api.example/api/', fetcher)
  assert.equal(page.status, 200)
  assert.ok(page.html.includes('<title>Cotton Shirt |'))
  assert.ok(page.html.includes('last recorded price $19.90 CAD'))
})

test('missing products are noindex 404s; upstream failures remain retryable', async () => {
  const missing = await renderPage('/products/E1', template, 'https://api.example/api', async () => new Response(null, { status: 404 }))
  assert.equal(missing.status, 404)
  assert.ok(missing.html.includes('content="noindex,follow"'))
  const failed = await renderPage('/products/E1', template, 'https://api.example/api', async () => new Response(null, { status: 500 }))
  assert.equal(failed.status, 503)
  assert.ok(failed.html.includes('id="root"'))
  assert.equal((await renderPage('/products/E1', template, undefined)).status, 503)
})

test('static route metadata does not depend on API availability', async () => {
  const page = await renderPage('/faq', template, undefined, async () => { throw new Error('must not fetch') })
  assert.equal(page.status, 200)
  assert.ok(page.html.includes('href="https://www.uniqlotracker.com/faq"'))
})
