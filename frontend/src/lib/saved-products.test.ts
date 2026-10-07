import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MARKETS } from './markets.ts'
import { addSavedProduct, parseSavedProducts, readSavedProducts, savedPriceChange, savedStorageKey, writeSavedProducts, type SavedStorage } from './saved-products.ts'
import type { Product } from '../types/types.ts'

const product: Product = { product_id: 'E1', name: 'Cotton shirt', price: 49.9, regular_price: 49.9, lowest_price: 29.9,
  categories: ['men/tops'], datetime: '2026-10-06T00:00:00Z', url: 'https://www.uniqlo.com/ca/en/products/E1', is_all_time_low: false }
const timestamp = '2026-10-06T12:00:00Z'
const memory = (): SavedStorage => {
  const data = new Map<string, string>()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } }
}

test('saved prices survive reloads and saving again never resets the baseline', () => {
  const storage = memory()
  const saved = addSavedProduct([], product, timestamp)
  assert.equal(writeSavedProducts(storage, MARKETS[0], saved), true)
  const loaded = readSavedProducts(storage, MARKETS[0])
  assert.equal(loaded.available, true)
  assert.equal(loaded.products[0].priceWhenSaved, 49.9)
  assert.equal(loaded.products[0].savedAt, timestamp)
  assert.equal(addSavedProduct(loaded.products, { ...product, price: 29.9 })[0].priceWhenSaved, 49.9)
  assert.equal(addSavedProduct(loaded.products, product).length, 1)
})

test('identical product IDs in different markets keep independent prices and lists', () => {
  const storage = memory()
  writeSavedProducts(storage, MARKETS[0], addSavedProduct([], product, timestamp))
  writeSavedProducts(storage, MARKETS[3], addSavedProduct([], { ...product, price: 2990 }, timestamp))
  assert.equal(readSavedProducts(storage, MARKETS[0]).products[0].priceWhenSaved, 49.9)
  assert.equal(readSavedProducts(storage, MARKETS[3]).products[0].priceWhenSaved, 2990)
  assert.deepEqual(readSavedProducts(storage, MARKETS[1]).products, [])
  assert.notEqual(savedStorageKey(MARKETS[0]), savedStorageKey(MARKETS[3]))
})

test('removal persists an empty list while a later save starts a new baseline', () => {
  const storage = memory()
  writeSavedProducts(storage, MARKETS[0], [])
  assert.deepEqual(readSavedProducts(storage, MARKETS[0]).products, [])
  const reSaved = addSavedProduct([], { ...product, price: 29.9 }, timestamp)
  assert.equal(reSaved[0].priceWhenSaved, 29.9)
})

test('malformed storage does not crash the page; invalid or duplicate entries are excluded', () => {
  for (const raw of [null, '', '{', 'null', '[]', '{"version":2,"products":[]}', '{"version":1,"products":{}}']) {
    assert.deepEqual(parseSavedProducts(raw), [])
  }
  const entry = addSavedProduct([], product, timestamp)[0]
  const invalid = [null, {}, { ...entry, savedAt: 'bad date' }, { ...entry, priceWhenSaved: -1 },
    { ...entry, product: { ...product, price: '49.90' } }, { ...entry, product: { ...product, categories: [null] } }]
  const loaded = parseSavedProducts(JSON.stringify({ version: 1, products: [...invalid, entry, entry] }))
  assert.equal(loaded.length, 1)
  assert.equal(loaded[0].product.name, product.name)
})

test('blocked storage reports failure so the app can retain the list in memory', () => {
  const storage: SavedStorage = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('quota') } }
  assert.deepEqual(readSavedProducts(storage, MARKETS[0]), { products: [], available: false })
  assert.equal(writeSavedProducts(storage, MARKETS[0], addSavedProduct([], product)), false)
})

test('price comparisons handle drops, rises, zero baselines, and floating-point cents', () => {
  assert.deepEqual(savedPriceChange(39.9, 49.9), { amount: -10, percent: 20 })
  assert.deepEqual(savedPriceChange(59.9, 49.9), { amount: 10, percent: 20 })
  assert.deepEqual(savedPriceChange(49.9, 49.9), { amount: 0, percent: 0 })
  assert.deepEqual(savedPriceChange(0.1 + 0.2, 0.3), { amount: 0, percent: 0 })
  assert.deepEqual(savedPriceChange(10, 0), { amount: 10, percent: null })
  assert.deepEqual(savedPriceChange(1990, 2990), { amount: -1000, percent: 33 })
})
