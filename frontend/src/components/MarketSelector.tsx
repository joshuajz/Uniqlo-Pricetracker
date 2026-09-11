import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

type MarketCode = 'CA' | 'US' | 'GB' | 'JP'

interface Market {
  code: MarketCode
  name: string
  currency: string
  tax: string
  available: boolean
}

const MARKETS: Market[] = [
  { code: 'CA', name: 'Canada', currency: 'CAD', tax: 'before tax', available: true },
  { code: 'US', name: 'United States', currency: 'USD', tax: 'before tax', available: false },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', tax: 'VAT included', available: false },
  { code: 'JP', name: 'Japan', currency: 'JPY', tax: 'tax included', available: false },
]

function MarketFlag({ code }: { code: MarketCode }) {
  return <img className="market-flag" src={`/flags/${code.toLowerCase()}.svg`} alt="" aria-hidden="true" />
}

function MarketDropdown({ markets }: { markets: Market[] }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const [selectedCode, setSelectedCode] = useState(markets[0].code)
  const selected = markets.find(market => market.code === selectedCode) ?? markets[0]

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return <div className="market-selector" ref={root}>
    <button type="button" className="market-trigger" aria-label={`${selected.name}, ${selected.currency}`} aria-haspopup="listbox" aria-expanded={open}
      aria-controls="market-list" onClick={() => setOpen(value => !value)}>
      <MarketFlag code={selected.code} />
      <span className="market-trigger-copy"><strong>{selected.name}</strong><small>{selected.currency} · {selected.tax}</small></span>
      <ChevronDown className={open ? 'is-open' : ''} size={16} aria-hidden="true" />
    </button>
    {open && <div className="market-list" id="market-list" role="listbox" aria-label="Country">
      {markets.map(market => <button type="button" key={market.code} role="option"
        className="market-option" aria-selected={market.code === selected.code}
        onClick={() => { setSelectedCode(market.code); setOpen(false) }}>
        <MarketFlag code={market.code} />
        <span><strong>{market.name}</strong><small>{market.currency} · {market.tax}</small></span>
      </button>)}
    </div>}
  </div>
}

export default function MarketSelector() {
  const availableMarkets = MARKETS.filter(market => market.available)
  if (availableMarkets.length === 0) return null

  if (availableMarkets.length === 1) {
    const market = availableMarkets[0]
    return <div className="market-selector market-current" aria-label={`Current market: ${market.name}`}>
      <MarketFlag code={market.code} />
      <strong>{market.name}</strong>
    </div>
  }

  return <MarketDropdown markets={availableMarkets} />
}
