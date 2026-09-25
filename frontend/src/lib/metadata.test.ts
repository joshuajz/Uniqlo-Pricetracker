import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { pageMetadata, renderMetadata, SITE_URL } from './metadata.ts'
import { recordingAge, recordingStatus } from './products.ts'

test('freshness distinguishes calendar dates and missing observations', () => {
  const now = Date.parse('2026-09-11T12:00:00Z')
  assert.equal(recordingStatus('2026-09-11T00:00:00Z', now), 'Prices checked today')
  assert.equal(recordingStatus('2026-09-10T00:00:00Z', now), 'Prices checked yesterday')
  assert.equal(recordingStatus('2026-09-09T00:00:00Z', now), 'Latest prices loaded')
  for (const date of [null, undefined, '', 'invalid']) {
    assert.equal(recordingStatus(date, now), 'Recording date unavailable')
    assert.ok(Number.isNaN(recordingAge(date, now)))
  }
  assert.notEqual(recordingStatus('2026-09-12', now), 'Prices checked today')
})

test('initial product HTML contains escaped product-specific sharing metadata', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  const product = { product_id: 'E1', name: 'Shirt "A" <script>alert(1)</script> & $&', price: 19.9 }
  const rendered = renderMetadata(html, pageMetadata('/products/E1', product))
  assert.ok(rendered.includes(`<link rel="canonical" href="${SITE_URL}/ca/products/E1"`))
  assert.ok(rendered.includes(`<meta property="og:url" content="${SITE_URL}/ca/products/E1"`))
  assert.ok(rendered.includes('last recorded price $19.90 CAD'))
  assert.ok(rendered.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  assert.ok(!rendered.includes('<script>alert(1)</script>'))
  assert.ok(rendered.includes('&amp; $&amp;'))
  for (const field of ['og:title', 'twitter:title', 'description', 'og:description', 'twitter:description']) {
    assert.match(rendered, new RegExp(`(?:name|property)="${field}" content="Shirt`))
  }
})

test('static and missing routes get their own canonical URLs and indexing policy', () => {
  for (const route of ['/categories', '/faq']) {
    assert.equal(pageMetadata(route).url, SITE_URL + '/ca' + route)
    assert.equal(pageMetadata(route).noindex, false)
  }
  assert.equal(pageMetadata('/products/missing', undefined, true).noindex, true)
  assert.equal(pageMetadata('/unknown').noindex, true)
})
