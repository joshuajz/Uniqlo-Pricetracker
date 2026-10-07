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


test('initial product body exposes recorded facts and navigation without JavaScript', async () => {
  const page = await renderPage('/jp/products/E1', template, 'https://api.example/api', async () => Response.json({
    name: '日本のシャツ <script>&', current_price: 1990, regular_price: 2990,
    lowest_price: { lowest_price: 1490 }, url: 'https://www.uniqlo.com/jp/item?x=1&y=2',
    datapoints: [{ datetime: '2026-10-06T00:00:00Z' }, { datetime: '2026-09-13T00:00:00Z' }],
  }))
  const body = page.html.split('<body>')[1].split('<script type="module"')[0]
  assert.ok(body.includes('<h1>日本のシャツ &lt;script&gt;&amp;</h1>'))
  assert.ok(body.includes('Last recorded price</dt><dd>¥1,990 JPY'))
  assert.ok(body.includes('Typical tracked price</dt><dd>¥2,990 JPY'))
  assert.ok(body.includes('Lowest recorded price</dt><dd>¥1,490 JPY'))
  assert.ok(body.includes('2026-09-13</time>'))
  assert.ok(body.includes('2026-10-06</time>'))
  assert.ok(body.includes('href="/jp/categories"'))
  assert.ok(body.includes('href="https://www.uniqlo.com/jp/item?x=1&amp;y=2"'))
  assert.ok(!body.includes('<script>'))
})

test('initial content omits unsafe store URLs and invalid optional facts', async () => {
  for (const url of ['javascript:alert(1)', 'https://uniqlo.com.evil.example/', 'http://www.uniqlo.com/']) {
    const page = await renderPage('/ca/products/E1', template, 'https://api.example/api', async () => Response.json({
      name: 'Shirt', current_price: 19.9, url, regular_price: null,
      lowest_price: { lowest_price: 'invalid' }, datapoints: [{ datetime: '\"><script>' }],
    }))
    assert.equal(page.status, 200)
    const body = page.html.split('<body>')[1]
    assert.ok(body.includes('<h1>Shirt</h1>'))
    assert.ok(!body.includes('Check sizes and availability'))
    assert.ok(!body.includes('Typical tracked price'))
    assert.ok(!body.includes('<time'))
  }
})

test('retailer-shaped URLs redirect to canonical regional histories', () => {
  assert.equal(redirectPath('/ca/en/products/E465185-000/00'), '/ca/products/E465185-000')
  assert.equal(redirectPath('/us/en/products/E465185-001/00'), '/us/products/E465185-001')
  assert.equal(redirectPath('/jp/ja/products/E465185-000/00'), '/jp/products/E465185-000')
  assert.equal(redirectPath('/gb/en/products/E465185-000/00'), '/uk/products/E465185-000')
  assert.equal(redirectPath('/ca/products/E465185-000'), undefined)
})


test('saved pages are successful but private browser lists are not indexed', async () => {
  for (const market of ['ca', 'us', 'uk', 'jp']) {
    const page = await renderPage(`/${market}/saved`, template, undefined, async () => { throw new Error('must not fetch') })
    assert.equal(page.status, 200)
    assert.ok(page.html.includes('<title>Saved products |'))
    assert.ok(page.html.includes(`href="https://www.uniqlotracker.com/${market}/saved"`))
    assert.ok(page.html.includes('content="noindex,follow"'))
  }
  assert.equal(redirectPath('/saved'), '/ca/saved')
})
