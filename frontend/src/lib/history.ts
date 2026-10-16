import type { ProductDatapoint } from '../types/types.ts'
import { DAY, recordedHistory } from './products.ts'

export type HistoryRange = '30' | '90' | '365' | 'all'
export const HISTORY_RANGES: { value: HistoryRange; label: string }[] = [
  { value: '30', label: '30 days' }, { value: '90', label: '90 days' },
  { value: '365', label: '1 year' }, { value: 'all', label: 'All time' },
]

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
