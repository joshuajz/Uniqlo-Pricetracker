import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { ExternalLink, X } from 'lucide-react'
import type { Product } from '../types/types'
import { ApiError, getProductDetail } from '../data/api'
import { track } from '../lib/analytics'
import { departmentsLabel, discountPct, formatRecordingDate, isLowestRecorded, isOnSale, money, productFromDetail, recordedHistory, recordingAge } from '../lib/products'
import ProductImage from './ProductImage'
import PriceHistory from './PriceHistory'

export default function ProductModal({ productId, product, archived, onClose }: {
  productId: string; product?: Product; archived: boolean; onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const tracked = useRef(false)
  const query = getProductDetail(productId)
  const p = useMemo(() => {
    if (!query.data) return product
    const detail = productFromDetail(query.data)
    return { ...detail, datetime: detail.datetime || product?.datetime || '',
      categories: detail.categories.length ? detail.categories : product?.categories ?? [] }
  }, [query.data, product])
  const observations = useMemo(() => recordedHistory(query.data?.datapoints ?? []), [query.data])
  const firstDate = observations.length ? new Date(observations[0].time).toISOString() : null
  const notFound = query.error instanceof ApiError && query.error.status === 404

  useLayoutEffect(() => {
    const dialog = dialogRef.current!
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!dialog.open) dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (trigger?.isConnected && trigger !== document.body) trigger.focus({ preventScroll: true })
      else document.getElementById('product-search')?.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (!p || tracked.current) return
    tracked.current = true
    track('product_modal_opened', { product_id: p.product_id, product_name: p.name, price: p.price,
      regular_price: p.regular_price, discount_pct: discountPct(p), is_atl: isLowestRecorded(p), is_on_sale: isOnSale(p) })
  }, [p])

  function close(via: string) {
    track('product_modal_closed', { product_id: productId, closed_via: via })
    closeRef.current()
  }

  return (
    <dialog ref={dialogRef} className="product-dialog" aria-labelledby="product-title"
      onCancel={e => { e.preventDefault(); close('escape') }}
      onClick={e => {
        if (e.target !== e.currentTarget) return
        const rect = e.currentTarget.getBoundingClientRect()
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) close('backdrop')
      }}>
      <div className="dialog-header"><span>Price details</span>
        <button className="icon-button" type="button" autoFocus aria-label="Close price details" onClick={() => close('button')}><X size={20} aria-hidden="true" /></button>
      </div>
      <div className="dialog-body">
        {p ? <>
          <div className="detail-product"><ProductImage key={p.product_id} id={p.product_id} name={p.name} eager />
            <div><p className="detail-category">{departmentsLabel(p)}</p><h2 id="product-title">{p.name}</h2><p className="product-id">{p.product_id}</p></div>
          </div>
          {archived && <p className="notice" role="status">This product isn't in the latest catalog. These are its last recorded prices; it may no longer be available.</p>}
          <div className="price-summary-blocks">
            <div className="price-summary-block"><span className="summary-label">Current price</span>
              <div className="summary-current">{money(p.price)} <small>CAD</small></div>
              <span className="summary-context">Typical tracked price {isOnSale(p) ? <del>{money(p.regular_price)}</del> : money(p.regular_price)}</span>
            </div>
            <div className={`price-summary-block ${isOnSale(p) ? 'saving-block' : ''}`}>
              <span className="summary-label">{isOnSale(p) ? 'Your savings' : 'Compared with typical'}</span>
              <div className="summary-saving">{isOnSale(p) ? money(p.regular_price - p.price)
                : p.price > p.regular_price ? `+${money(p.price - p.regular_price)}` : 'No difference'}</div>
              <span className="summary-context">{isOnSale(p) ? `${discountPct(p)}% below typical`
                : p.price > p.regular_price ? 'Above the typical tracked price' : 'Matches the typical tracked price'}</span>
            </div>
          </div>
          {(!query.data || observations.length > 0) && <div className={`lowest-banner ${isLowestRecorded(p) ? 'at-lowest' : ''}`}>
            <strong>{isLowestRecorded(p) ? 'Lowest recorded price' : p.price > p.lowest_price ? `Lowest recorded: ${money(p.lowest_price)}` : 'No lower price recorded yet'}</strong>
            <span>{firstDate ? `Tracking since ${formatRecordingDate(firstDate)}`
              : p.price > p.lowest_price ? `${money(p.price - p.lowest_price)} below the current price` : 'Price history is loading'}</span>
          </div>}
        </> : <h2 id="product-title">{notFound ? 'Product not found' : 'Product details'}</h2>}

        {query.isPending && <div className="detail-loading" role="status"><div className="skeleton chart-skeleton" aria-hidden="true" /><p>Loading price history…</p></div>}
        {query.isError && <div className="inline-error" role="alert">
          <h3>{notFound ? 'This product link is unavailable' : 'Price history couldn’t load'}</h3>
          <p>{notFound ? 'The ID may be incorrect, or this product has no recorded history.' : 'Try again. You can still check Uniqlo for the current price.'}</p>
          {!notFound && <button type="button" className="secondary-button" disabled={query.isFetching} onClick={() => { void query.refetch() }}>{query.isFetching ? 'Retrying…' : 'Retry price history'}</button>}
          {notFound && <button type="button" className="primary-button" onClick={() => close('unavailable')}>Back to products</button>}
        </div>}
        {query.data && <PriceHistory datapoints={query.data.datapoints} typicalPrice={query.data.regular_price} />}
        {p && <>
          <p className="recording-note">Prices checked <time dateTime={p.datetime.slice(0, 10)}>{formatRecordingDate(p.datetime)}</time> · Updated daily</p>
          {!archived && recordingAge(p.datetime) > 1 && <p className="notice">This price is {recordingAge(p.datetime)} days old. Confirm the current price on Uniqlo.</p>}
          <details className="comparison-explanation"><summary>How we compare prices</summary>
            <p>Typical tracked price is the most frequently recorded price. Discounts compare the current observation with that price, and may differ from Uniqlo's advertised promotions.</p>
            <p>Lowest recorded is the lowest price observed since tracking began. The badge highlights products at that low and below their typical price. It doesn't describe prices before tracking started.</p>
          </details>
        </>}
      </div>
      {p && <div className="dialog-footer">
          <a className="primary-button store-link" href={p.url} target="_blank" rel="noopener noreferrer"
            onClick={() => track('view_on_uniqlo_clicked', { product_id: p.product_id, product_name: p.name, price: p.price, is_atl: isLowestRecorded(p), is_on_sale: isOnSale(p) })}>
            Check sizes on Uniqlo <ExternalLink size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
          </a>
      </div>}
    </dialog>
  )
}
