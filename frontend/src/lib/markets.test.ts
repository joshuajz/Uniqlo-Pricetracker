import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_MARKET, findMarket, legacyDestination, MARKET_STORAGE_KEY, MARKETS, marketPath, money, rememberedMarket, rememberMarket, splitMarketPath, switchedMarketPath } from './markets.ts'

test('all storefronts have distinct routes and currencies; UK maps to GB storage', () => {
  assert.deepEqual(MARKETS.map(m => [m.slug, m.code, m.currency]), [
    ['ca', 'CA', 'CAD'], ['us', 'US', 'USD'], ['uk', 'GB', 'GBP'], ['jp', 'JP', 'JPY'],
  ])
  assert.equal(findMarket('gb'), findMarket('uk'))
  assert.equal(findMarket('US')?.slug, 'us')
  assert.equal(findMarket('au'), undefined)
  assert.equal(splitMarketPath('/jpy/products/E1').market, undefined)
  assert.equal(splitMarketPath('/jp/products/E1').path, '/products/E1')
  assert.equal(marketPath(findMarket('gb')!, '/categories'), '/uk/categories')
})

test('home uses the remembered country and legacy links keep their Canadian meaning', () => {
  const jp = findMarket('jp')!
  assert.equal(legacyDestination('/'), '/ca')
  assert.equal(legacyDestination('/', jp), '/jp')
  assert.equal(legacyDestination('/', jp, '?modal=E1'), '/ca')
  assert.equal(legacyDestination('/products/E1', jp), '/ca/products/E1')
  assert.equal(legacyDestination('/categories', jp), '/ca/categories')
  assert.equal(legacyDestination('/dashboard', jp), '/ca')
})

test('storage persists a valid selection and safely defaults to Canada when blocked or invalid', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  let saved: string | null = null
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem(key: string) { assert.equal(key, MARKET_STORAGE_KEY); return saved },
      setItem(key: string, value: string) { assert.equal(key, MARKET_STORAGE_KEY); saved = value },
    } })
    assert.equal(rememberedMarket(), DEFAULT_MARKET)
    rememberMarket(findMarket('us')!)
    assert.equal(saved, 'us')
    assert.equal(rememberedMarket().code, 'US')
    saved = 'invalid'
    assert.equal(rememberedMarket(), DEFAULT_MARKET)
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Blocked') } })
    assert.equal(rememberedMarket(), DEFAULT_MARKET)
    assert.doesNotThrow(() => rememberMarket(findMarket('jp')!))
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('switching country preserves page type but never assumes product equivalence', () => {
  const us = findMarket('us')!
  assert.equal(switchedMarketPath('/ca', us), '/us')
  assert.equal(switchedMarketPath('/ca/categories', us), '/us/categories')
  assert.equal(switchedMarketPath('/ca/products/E1', us), '/us/categories')
  assert.equal(switchedMarketPath('/uk/faq', us), '/us/faq')
})

test('prices use native currency precision without currency conversion', () => {
  assert.equal(money(19.9), '$19.90')
  assert.equal(money(19.9, findMarket('us')!), '$19.90')
  assert.equal(money(19.9, findMarket('uk')!), '£19.90')
  assert.equal(money(1990, findMarket('jp')!), '¥1,990')
})
