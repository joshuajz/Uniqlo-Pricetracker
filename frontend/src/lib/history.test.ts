import assert from 'node:assert/strict'
import { test } from 'node:test'
import { historySummary, historyWindow, priceAxis } from './history.ts'
import { DAY } from './products.ts'
const point = (datetime: string, price: number) => ({ datetime, price, categories: [] })

test('price scales use readable currency steps without hiding data', () => {
  assert.deepEqual(priceAxis(12.9, 49.9).ticks, [10, 20, 30, 40, 50])
  for (const [min, max, unit] of [[0, 0, .01], [49.9, 49.9, .01], [.01, .03, .01], [990, 4990, 1], [1, 1, 1]]) {
    const { domain, ticks } = priceAxis(min, max, unit)
    assert.ok(domain[0] >= 0 && domain[0] <= min && domain[1] >= max)
    assert.ok(domain[1] > domain[0])
    assert.ok(ticks.length >= 2 && ticks.length <= 7)
    assert.ok(ticks.every(value => Math.abs(value / unit - Math.round(value / unit)) < 1e-6))
  }
})

test('history ranges are inclusive and anchored to the last recording, including archived products', () => {
  const end = Date.parse('2024-01-31T00:00:00Z')
  const data = Array.from({length:40}, (_,i) => point(new Date(end - i * DAY).toISOString(), 10))
  assert.equal(historyWindow(data,'30').length,30)
  assert.equal(historyWindow(data,'90').length,40)
  assert.equal(historyWindow(data,'all').length,40)
  assert.deepEqual(historyWindow([],'30'),[])
})

test('summary reports the latest low date and does not invent a streak across missing days', () => {
  const data = [point('2026-10-01',30),point('2026-10-03',20),point('2026-10-04',20)]
  const summary = historySummary(data)!
  assert.equal(summary.streak,2)
  assert.equal(summary.low.time,Date.parse('2026-10-04T00:00:00Z'))
  assert.equal(summary.high.price,30)
  assert.equal(historySummary([point('2026-10-01',20),point('2026-10-03',20)])!.streak,1)
  assert.equal(historySummary([]),null)
})
