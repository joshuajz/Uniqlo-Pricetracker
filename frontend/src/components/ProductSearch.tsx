import { useState } from 'react'
import { ArrowRight, Link as LinkIcon, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { looksLikeProductLink, parseProductLink, type ProductLink } from '../lib/product-links'

interface Props {
  query: string
  onQueryChange: (value: string) => void
  origin: string
  dealsOnly: boolean
}

export default function ProductSearch({ query, onQueryChange, origin, dealsOnly }: Props) {
  const navigate = useNavigate()
  const [linkInput, setLinkInput] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const value = linkInput ?? query
  const linkMode = looksLikeProductLink(value)
  let link: ProductLink | undefined
  let error = ''
  if (linkMode) {
    try { link = parseProductLink(value) } catch (cause) { error = (cause as Error).message }
  }
  function change(value: string) {
    setSubmitted(false)
    if (looksLikeProductLink(value)) {
      setLinkInput(value)
      if (query) onQueryChange('')
    } else {
      setLinkInput(null)
      onQueryChange(value)
    }
  }
  return <div className="product-search-control">
    <form className="search-box" onSubmit={event => {
      event.preventDefault()
      if (!linkMode) return
      setSubmitted(true)
      if (link) navigate(link.historyPath, { state: { productPageOrigin: origin } })
    }}>
      <label className="sr-only" htmlFor="product-search">Search {dealsOnly ? 'deals' : 'all products'}, product IDs, or paste a Uniqlo link</label>
      {linkMode ? <LinkIcon size={19} aria-hidden="true" /> : <Search size={19} aria-hidden="true" />}
      <input id="product-search" type="search" placeholder="Search products, IDs, or paste a Uniqlo link"
        value={value} onChange={event => change(event.target.value)}
        aria-invalid={submitted && !!error || undefined} aria-describedby={linkMode ? 'product-link-feedback' : undefined} />
      {value && <button className="icon-button" type="button" aria-label="Clear search"
        onClick={() => { change(''); document.getElementById('product-search')?.focus() }}><X size={18} aria-hidden="true" /></button>}
      {linkMode && <button className="product-link-submit" type="submit" aria-label="View price history">
        <span>View history</span><ArrowRight size={17} aria-hidden="true" />
      </button>}
    </form>
    {linkMode && <div id="product-link-feedback" className={`product-link-feedback${submitted && error ? ' has-error' : ''}`}
      role={submitted && error ? 'alert' : 'status'}>
      {link ? <><strong>{link.market.name}</strong><span> · {link.productId} · Opens this country’s price history</span></>
        : submitted ? error : 'Paste an individual Uniqlo product link, then press Enter or View history.'}
    </div>}
  </div>
}
