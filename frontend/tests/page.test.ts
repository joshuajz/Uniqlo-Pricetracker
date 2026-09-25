import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { redirectPath, renderPage } from '../api/page.ts'

const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

test('product route returns sharing metadata before JavaScript runs', async () => {
  const fetcher: typeof fetch = async (url) => {
    assert.equal(url, 'https://api.example/api/ca/product/E1')
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
  assert.ok(page.html.includes('href="https://www.uniqlotracker.com/ca/faq"'))
})

test('legal routes return indexable document-specific metadata', async () => {
  for (const [path, title] of [['/terms', 'Terms of service'], ['/privacy', 'Privacy policy']]) {
    const page = await renderPage(path, template, undefined, async () => { throw new Error('must not fetch') })
    assert.equal(page.status, 200)
    assert.ok(page.html.includes(`<title>${title} |`))
    assert.ok(page.html.includes(`href="https://www.uniqlotracker.com/ca${path}"`))
    assert.ok(page.html.includes('content="index,follow"'))
  }
})


test('regional product HTML fetches the correct market and uses its currency and canonical', async () => {
  for (const [slug, country, price, formatted] of [
    ['us', 'United States', 29.9, '$29.90 USD'],
    ['uk', 'United Kingdom', 24.9, '£24.90 GBP'],
    ['jp', 'Japan', 1990, '¥1,990 JPY'],
  ] as const) {
    const page = await renderPage(`/${slug}/products/E1`, template, 'https://api.example/api', async url => {
      assert.equal(url, `https://api.example/api/${slug}/product/E1`)
      return Response.json({ name: 'Shirt', current_price: price })
    })
    assert.equal(page.status, 200)
    assert.ok(page.html.includes(`Uniqlo Price Tracker ${country}</title>`))
    assert.ok(page.html.includes(`last recorded price ${formatted}`))
    assert.ok(page.html.includes(`href="https://www.uniqlotracker.com/${slug}/products/E1"`))
  }
})

test('aliases redirect to canonical regional URLs while root waits for browser preference', () => {
  assert.equal(redirectPath('/'), undefined)
  assert.equal(redirectPath('/products/E1'), '/ca/products/E1')
  assert.equal(redirectPath('/gb/products/E1'), '/uk/products/E1')
  assert.equal(redirectPath('/US/categories'), '/us/categories')
  assert.equal(redirectPath('/jp/'), '/jp')
  assert.equal(redirectPath('/uk/dashboard'), '/uk')
  assert.equal(redirectPath('/us'), undefined)
})

test('every country landing page works without the API, and unknown routes are 404s', async () => {
  for (const slug of ['ca', 'us', 'uk', 'jp']) {
    const page = await renderPage(`/${slug}`, template, undefined)
    assert.equal(page.status, 200)
    assert.ok(page.html.includes(`href="https://www.uniqlotracker.com/${slug}"`))
  }
  for (const path of ['/au', '/us/not-a-page', '/au/products/E1']) {
    const page = await renderPage(path, template, undefined)
    assert.equal(page.status, 404)
    assert.ok(page.html.includes('content="noindex,follow"'))
  }
})
