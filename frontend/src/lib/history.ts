import type { ProductDatapoint } from '../types/types.ts'
import { DAY, recordedHistory } from './products.ts'

export type HistoryRange = '30' | '90' | '365' | 'all'
export const HISTORY_RANGES: { value: HistoryRange; label: string }[] = [
  { value: '30', label: '30 days' }, { value: '90', label: '90 days' },
  { value: '365', label: '1 year' }, { value: 'all', label: 'All time' },
]

// Round the visible scale to currency-friendly steps, including flat histories.
export function priceAxis(min: number, max: number, unit = .01) {
  const padding = min === max ? Math.max(unit * 2, max * .1) : 0
  const low = Math.max(0, min - padding)
  const high = max + padding
  const roughStep = Math.max(unit, (high - low) / 4)
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const step = Math.max(unit, [1, 2, 5, 10].find(value => value * magnitude >= roughStep)! * magnitude)
  const lower = Math.floor(low / step) * step
  const upper = Math.max(lower + step, Math.ceil(high / step) * step)
  const ticks = Array.from({ length: Math.round((upper - lower) / step) + 1 }, (_, index) => Number((lower + index * step).toFixed(2)))
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks }
}

// Anchor to the latest observation so archived products retain useful ranges.
export function historyWindow(datapoints: ProductDatapoint[], range: HistoryRange) {
  const observations = recordedHistory(datapoints)
  const end = observations[observations.length - 1]?.time
  const start = end === undefined || range === 'all' ? -Infinity : end - (Number(range) - 1) * DAY
  return datapoints.filter(point => Date.parse(`${point.datetime.slice(0, 10)}T00:00:00Z`) >= start)
}

export function historySummary(datapoints: ProductDatapoint[]) {
  const observations = recordedHistory(datapoints)
  if (!observations.length) return null
  let low = observations[0]
  let high = observations[0]
  for (const point of observations) {
    if (point.price <= low.price) low = point
    if (point.price >= high.price) high = point
  }
  const last = observations[observations.length - 1]
  let streak = 1
  for (let i = observations.length - 2; i >= 0; i--) {
    if (observations[i].price !== last.price || observations[i + 1].time - observations[i].time !== DAY) break
    streak++
  }
  return { low, high, last, streak }
}
