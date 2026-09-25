import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useMarket } from '../context/MarketContext'
import { MARKETS, switchedMarketPath } from '../lib/markets'

export default function MarketSelector() {
  const selected = useMarket()
  const { pathname, search, hash } = useLocation()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return <div className="market-selector" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <button ref={trigger} type="button" className="market-trigger" aria-label={`Change country: ${selected.name}, ${selected.currency}`}
      aria-expanded={open} aria-controls="market-list" onClick={() => setOpen(value => !value)}>
      <img className="market-flag" src={`/flags/${selected.code.toLowerCase()}.svg`} alt="" />
      <span className="market-trigger-copy"><strong>{selected.name}</strong><small>{selected.currency} · {selected.tax}</small></span>
      <span className="market-mobile-code" aria-hidden="true">{selected.currency}</span>
      <ChevronDown className={open ? 'is-open' : ''} size={16} aria-hidden="true" />
    </button>
    {open && <nav className="market-list" id="market-list" aria-label="Choose country">
      {MARKETS.map(market => <Link key={market.code} className="market-option"
        to={market.code === selected.code ? pathname + search + hash : switchedMarketPath(pathname, market)}
        aria-current={market.code === selected.code ? 'true' : undefined} onClick={() => setOpen(false)}>
        <img className="market-flag" src={`/flags/${market.code.toLowerCase()}.svg`} alt="" />
        <span><strong>{market.name}</strong><small>{market.currency} · {market.tax}</small></span>
      </Link>)}
    </nav>}
  </div>
}
