import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { ArrowRight, Bookmark, Monitor, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useMarket } from '../context/MarketContext'
import { useSavedProducts } from '../context/SavedProductsContext'
import { ApiError, productDetailOptions, useProducts } from '../data/api'
import { marketPath, money } from '../lib/markets'
import { departmentsLabel, formatRecordingDate, isLowestRecorded, isOnSale, productCategory, productFromDetail, recordingAge } from '../lib/products'
import { savedPriceChange } from '../lib/saved-products'
import ProductImage from '../components/ProductImage'
import SavedPriceChange from '../components/SavedPriceChange'

export default function SavedPage() {
  const market = useMarket()
  const location = useLocation()
  const { products: saved, remove, storageAvailable } = useSavedProducts()
  const catalogue = useProducts()
  const [filter, setFilter] = useState<'all' | 'drops'>('all')
  const [sort, setSort] = useState('saved')
  const listed = useMemo(() => new Map(catalogue.data?.products.map(p => [p.product_id, p]) ?? []), [catalogue.data])
  const missing = saved.filter(entry => catalogue.data && !listed.has(entry.product.product_id))
  const details = useQueries({ queries: missing.map(entry => productDetailOptions(entry.product.product_id, market)) })
  const rows = saved.map(entry => {
    const id = entry.product.product_id
    const detail = details[missing.findIndex(item => item.product.product_id === id)]
    const live = listed.get(id) ?? (detail?.data ? productFromDetail(detail.data) : undefined)
    return { entry, product: live ?? entry.product, live: !!live,
      missing: !!catalogue.data && !listed.has(id), refreshing: detail?.isPending,
      notFound: detail?.error instanceof ApiError && detail.error.status === 404 }
  })
  const drops = rows.filter(row => row.live && savedPriceChange(row.product.price, row.entry.priceWhenSaved).amount < 0)
  const visible = (filter === 'drops' ? drops : rows).slice().sort((a, b) => sort === 'price' ? a.product.price - b.product.price
    : sort === 'drop' ? (a.product.price - a.entry.priceWhenSaved) - (b.product.price - b.entry.priceWhenSaved)
      : Date.parse(b.entry.savedAt) - Date.parse(a.entry.savedAt))
  return <div className="saved-page page-container">
    <header className="saved-heading">
      <div><p className="browse-eyebrow">Your watchlist · {market.name}</p><h1>Saved<span> for later.</span></h1></div>
      {saved.length > 0 && <Link className="secondary-button" to={marketPath(market, '/categories')}>Browse products <ArrowRight size={16} aria-hidden="true" /></Link>}
    </header>
    <p className="saved-device-note"><Monitor size={16} aria-hidden="true" /><span><strong>{storageAvailable ? 'Saved in this browser.' : 'Saved for this visit.'}</strong> No account needed. Your list won’t sync to other devices.</span></p>
    {saved.length > 0 && <>
      {catalogue.isPending && <p className="notice" role="status">Refreshing saved prices… Showing prices recorded when saved.</p>}
      {catalogue.isError && <p className="notice" role="status">Latest prices couldn’t load. {catalogue.data ? 'Showing the last loaded prices.' : 'Showing prices recorded when saved.'} <button type="button" className="text-button" onClick={() => { void catalogue.refetch() }}>Try again</button></p>}
      <div className="saved-toolbar"><div className="saved-filters" role="group" aria-label="Saved product filter">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All saved <small>{saved.length}</small></button>
        <button type="button" aria-pressed={filter === 'drops'} onClick={() => setFilter('drops')}>Price drops <small>{drops.length}</small></button>
      </div><label className="sort-label">Sort by <select aria-label="Sort saved products" value={sort} onChange={event => setSort(event.target.value)}>
        <option value="saved">Recently saved</option><option value="drop">Biggest price drop</option><option value="price">Lowest price</option>
      </select></label></div>
      {visible.length > 0 && <div className="saved-column-head" aria-hidden="true"><span>Product</span><span>Current price · {market.currency}</span><span>Since you saved</span><span /></div>}
      <ul className="saved-results">{visible.map(({ entry, product, live, missing, refreshing, notFound }) => <li className="saved-row" key={product.product_id}>
        <div className="saved-identity"><Link to={marketPath(market, `/products/${encodeURIComponent(product.product_id)}`)} tabIndex={-1} aria-hidden="true"><ProductImage id={product.product_id} /></Link>
          <div><Link className="saved-product-name" to={marketPath(market, `/products/${encodeURIComponent(product.product_id)}`)}
            state={{ product, productPageOrigin: location.pathname }}>{product.name}</Link>
            <p className="product-meta">{departmentsLabel(product)} · {productCategory(product)}</p>
            {live && !missing && (isLowestRecorded(product) ? <span className="low-badge">Lowest recorded</span> : isOnSale(product) ? <span className="low-badge">Below typical price</span> : null)}
            {missing && <p className="saved-row-note">{refreshing ? 'Refreshing price…' : notFound ? 'No longer tracked' : live ? 'Not in current catalogue' : 'Latest price unavailable'}</p>}
          </div>
        </div>
        <div className="saved-current"><strong>{money(product.price, market)}</strong>
          <small>{live ? `Typical ${money(product.regular_price, market)}` : 'Price when saved'}</small>
          {(!live || missing || recordingAge(product.datetime) > 1) && <small>Recorded {formatRecordingDate(product.datetime, false)}</small>}
        </div>
        {live ? <SavedPriceChange current={product.price} baseline={entry.priceWhenSaved} /> : <div className="saved-price-change"><strong>Awaiting latest price</strong><small>{money(entry.priceWhenSaved, market)} when saved</small></div>}
        <button type="button" className="saved-remove" aria-label={`Remove ${product.name} from Saved`} onClick={() => remove(product.product_id)}><X size={15} aria-hidden="true" /> Remove</button>
      </li>)}</ul>
      {visible.length === 0 && <div className="saved-empty"><div className="saved-empty-icon"><Bookmark size={32} aria-hidden="true" /></div>
        <h2>{catalogue.isPending || catalogue.isError && !catalogue.data ? 'Price drops aren’t available yet.' : 'No price drops yet.'}</h2>
        <p>{catalogue.isPending || catalogue.isError && !catalogue.data ? 'We need the latest prices to compare with your saved prices.' : 'No refreshed prices are below their price when saved. Check back after the next daily update.'}</p>
        <button type="button" className="primary-button" onClick={() => setFilter('all')}>Show all saved <ArrowRight size={16} aria-hidden="true" /></button>
      </div>}
      <div className="saved-freshness"><p>{catalogue.data?.datetime ? <>Prices checked <time dateTime={catalogue.data.datetime}>{formatRecordingDate(catalogue.data.datetime, false)}</time></> : `${market.name} · ${market.currency}`}</p>
        <p>Changes compare the latest recorded price with the price when you saved the product.</p></div>
    </>}
    {saved.length === 0 && <div className="saved-empty"><div className="saved-empty-icon"><Bookmark size={32} aria-hidden="true" /></div>
      <h2>Keep an eye on your favourites.</h2><p>Save products as you browse. Come back here to see their latest prices and what’s changed.</p>
      <Link className="primary-button" to={marketPath(market, '/categories')}>Browse products <ArrowRight size={16} aria-hidden="true" /></Link></div>}
  </div>
}
