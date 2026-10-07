import assert from 'node:assert/strict'
import { test } from 'node:test'
import { looksLikeProductLink, parseProductLink, productLinkFromPath, retailerUrlForProduct } from './product-links.ts'
import { findMarket } from './markets.ts'

test('links preserve the edition ID and country, including French Canada and Japan', () => {
  for (const [country, language, canonical] of [['ca', 'en', 'ca'], ['ca', 'fr', 'ca'], ['us', 'en', 'us'], ['uk', 'en', 'uk'], ['gb', 'en', 'uk'], ['jp', 'ja', 'jp']]) {
    const link = parseProductLink(`https://www.uniqlo.com/${country}/${language}/products/E465185-001/00?colorDisplayCode=09#sizes`)
    assert.equal(link.historyPath, `/${canonical}/products/E465185-001`)
    assert.equal(link.productId, 'E465185-001')
    assert.equal(link.market.slug, canonical)
    assert.ok(link.retailerUrl.endsWith('/E465185-001/00'))
  }
})

test('pasted links may omit the scheme; replacing uniqlo with uniqlotracker works', () => {
  for (const host of ['www.uniqlo.com', 'uniqlo.com', 'www.uniqlotracker.com', 'uniqlotracker.com']) {
    assert.equal(parseProductLink(`  ${host}/us/en/products/E465185-000/00  `).historyPath, '/us/products/E465185-000')
  }
  assert.equal(parseProductLink('https://www.uniqlo.com/jp/ja/products/E465185-000').retailerUrl,
    'https://www.uniqlo.com/jp/ja/products/E465185-000/00')
})

test('invalid hosts, credentials, protocols, markets and non-product pages are rejected', () => {
  for (const value of [
    'https://uniqlo.com.evil.com/ca/en/products/E465185-000/00',
    'https://evil.com/ca/en/products/E465185-000/00',
    'https://user:password@uniqlo.com/ca/en/products/E465185-000/00',
    'https://uniqlo.com:8443/ca/en/products/E465185-000/00',
    'javascript:alert(1)', 'ftp://uniqlo.com/ca/en/products/E465185-000/00',
    'https://www.uniqlo.com/au/en/products/E465185-000/00',
    'https://www.uniqlo.com/ca/en/women',
    'https://www.uniqlo.com/ca/en/products/465185/00',
    'https://www.uniqlo.com/ca/en/products/E465185-000/00/other',
  ]) assert.throws(() => parseProductLink(value), Error, value)
})

test('retailer paths redirect without intercepting canonical history routes', () => {
  assert.equal(productLinkFromPath('/ca/en/products/E465185-000/00')?.historyPath, '/ca/products/E465185-000')
  assert.equal(productLinkFromPath('/gb/en/products/E465185-000/')?.historyPath, '/uk/products/E465185-000')
  for (const path of ['/ca/products/E465185-000', '/ca/categories', '/ca/en/women', '/au/en/products/E465185-000/00']) {
    assert.equal(productLinkFromPath(path), undefined)
  }
  assert.equal(retailerUrlForProduct(findMarket('jp')!, 'E465185-000'), 'https://www.uniqlo.com/jp/ja/products/E465185-000/00')
  assert.equal(retailerUrlForProduct(findMarket('ca')!, 'not-an-id'), undefined)
})

test('ordinary names and IDs retain live search behavior', () => {
  for (const value of ['AIRism cotton', 'E465185-000', '465185', '']) assert.equal(looksLikeProductLink(value), false)
  for (const value of ['https://uniqlo.com/ca/en/women', 'www.uniqlo.com/ca/en/products/E465185-000/00', 'uniqlo.com/us/en/products/E465185-000/00']) {
    assert.equal(looksLikeProductLink(value), true)
  }
})
