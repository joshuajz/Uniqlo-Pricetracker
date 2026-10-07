import { useMarket } from '../context/MarketContext'
import { money } from '../lib/markets'
import { savedPriceChange } from '../lib/saved-products'

export default function SavedPriceChange({ current, baseline }: { current: number; baseline: number }) {
  const market = useMarket()
  const { amount, percent } = savedPriceChange(current, baseline)
  const direction = amount < 0 ? 'lower' : 'higher'
  return <div className={`saved-price-change ${amount < 0 ? 'is-lower' : ''}`}>
    <strong>{amount === 0 ? 'No change' : <><span aria-hidden="true">{amount < 0 ? '↓ ' : '↑ '}</span>{money(Math.abs(amount), market)} {direction}</>}</strong>
    <small>{money(baseline, market)} when saved{amount !== 0 && percent !== null && ` · ${percent}% ${direction}`}</small>
  </div>
}
