import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ApiError, getProductDetail, getProducts } from '../data/api'
import { track } from '../lib/analytics'
import { applyMetadata, pageMetadata } from '../lib/metadata'
import {
  departmentsLabel, discountPct, formatRecordingDate, isLowestRecorded, isOnSale, money,
  productCategory, productFromDetail, recordedHistory, recordingAge,
} from '../lib/products'
import type { Product } from '../types/types'
import ProductImage from '../components/ProductImage'

const PriceHistory = lazy(() => import('../components/PriceHistory'))

interface ProductLocationState {
  product?: Product
  productPageOrigin?: string
}

export default function ProductPage() {
  const { productId = '' } = useParams()
  const location = useLocation()
  const state = (location.state ?? {}) as ProductLocationState
  const productsQuery = getProducts()
  const detailQuery = getProductDetail(productId)
  const tracked = useRef('')
  const product = useMemo(() => {
    const listed = productsQuery.data?.products.find(item => item.product_id === productId) ?? state.product
    if (!detailQuery.data) return listed
    const detailed = productFromDetail(detailQuery.data)
    return {
      ...detailed,
      datetime: detailed.datetime || listed?.datetime || '',
      categories: detailed.categories.length ? detailed.categories : listed?.categories ?? [],
    }
  }, [detailQuery.data, productId, productsQuery.data, state.product])
  const observations = useMemo(() => recordedHistory(detailQuery.data?.datapoints ?? []), [detailQuery.data])
  const firstDate = observations[0] ? new Date(observations[0].time).toISOString() : null
  const archived = !!productsQuery.data && !productsQuery.data.products.some(item => item.product_id === productId)
  const notFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404
  const origin = typeof state.productPageOrigin === 'string' && state.productPageOrigin.startsWith('/')
    ? state.productPageOrigin : '/categories'
  const backLabel = origin.startsWith('/categories') ? 'All products' : 'Back to deals'

  useEffect(() => {
    applyMetadata(pageMetadata(location.pathname, product, notFound))
  }, [location.pathname, product, notFound])

  useEffect(() => {
    if (!product || tracked.current === product.product_id) return
    tracked.current = product.product_id
    track('product_page_viewed', {
      product_id: product.product_id, product_name: product.name, price: product.price,
      regular_price: product.regular_price, discount_pct: discountPct(product),
      is_atl: isLowestRecorded(product), is_on_sale: isOnSale(product),
    })
  }, [product])

  if (!product && detailQuery.isPending) return <div className="product-detail-page page-container">
    <Link className="product-back-link" to={origin}><ArrowLeft size={15} aria-hidden="true" />{backLabel}</Link>
    <h1 tabIndex={-1}>Product details</h1>
    <div className="product-page-loading" role="status"><div className="skeleton product-hero-skeleton" aria-hidden="true" /><p>Loading product…</p></div>
  </div>

  if (!product) return <div className="product-detail-page page-container">
    <Link className="product-back-link" to={origin}><ArrowLeft size={15} aria-hidden="true" />{backLabel}</Link>
    <div className="product-page-error inline-error" role="alert">
      <h1 tabIndex={-1}>{notFound ? 'Product not found' : 'Product details couldn’t load'}</h1>
      <p>{notFound ? 'This product has no recorded history.' : 'Try loading the product again.'}</p>
      <div className="empty-actions">
        {!notFound && <button type="button" className="primary-button" disabled={detailQuery.isFetching}
          onClick={() => { void detailQuery.refetch() }}>{detailQuery.isFetching ? 'Retrying…' : 'Retry'}</button>}
        <Link className={notFound ? 'primary-button' : 'secondary-button'} to={origin}>{backLabel}</Link>
      </div>
    </div>
  </div>

  const saving = product.regular_price - product.price
  const priceStatus = isLowestRecorded(product) ? 'Lowest recorded'
    : isOnSale(product) ? 'Below typical'
      : product.price > product.lowest_price ? `Lowest recorded: ${money(product.lowest_price)}` : 'No lower price recorded'
  const priceContext = isOnSale(product) ? `Save ${money(saving)} · ${discountPct(product)}%`
    : product.price > product.lowest_price ? `${money(product.price - product.lowest_price)} above the low` : ''

  return <div className="product-detail-page page-container">
    <nav className="product-page-path" aria-label="Breadcrumb">
      <Link className="product-back-link" to={origin}><ArrowLeft size={15} aria-hidden="true" />{backLabel}</Link>
      <span>{departmentsLabel(product)} · {productCategory(product)}</span>
    </nav>

    <article className="product-page-hero">
      <div className="product-page-image-stage">
        <ProductImage key={product.product_id} id={product.product_id} name={product.name} eager />
      </div>
      <div className="product-page-summary">
        <header className="product-page-title">
          <p className="product-page-code">{product.product_id}</p>
          <h1 tabIndex={-1}>{product.name}</h1>
        </header>
        <div className="product-page-buy">
          <div className="product-page-price"><strong>{money(product.price)}</strong><span>CAD</span>
            {isOnSale(product) && <span className="product-page-typical"><span>Typical</span>
              <del aria-label={`Typical tracked price ${money(product.regular_price)}`}>{money(product.regular_price)}</del></span>}
          </div>
          <div className={`product-page-verdict ${isLowestRecorded(product) ? 'at-lowest' : ''}`}>
            <strong>{priceStatus}</strong>{priceContext && <span>{priceContext}</span>}
          </div>
          <a className="primary-button product-store-link" href={product.url} target="_blank" rel="noopener noreferrer"
            onClick={() => track('view_on_uniqlo_clicked', {
              product_id: product.product_id, product_name: product.name, price: product.price,
              is_atl: isLowestRecorded(product), is_on_sale: isOnSale(product),
            })}>
            Check sizes on Uniqlo <ExternalLink size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        <dl className="product-page-facts">
          <div><dt>Checked</dt><dd><time dateTime={product.datetime.slice(0, 10)}>{formatRecordingDate(product.datetime)}</time></dd></div>
          <div><dt>Tracking since</dt><dd>{firstDate ? formatRecordingDate(firstDate) : detailQuery.isPending ? 'Loading…' : 'Unavailable'}</dd></div>
        </dl>
      </div>
    </article>

    {archived && <p className="notice" role="status">This product isn’t in the latest catalog. Its last recorded prices remain available.</p>}
    {!archived && recordingAge(product.datetime) > 1 && <p className="notice" role="status">This price is {recordingAge(product.datetime)} days old. Confirm it on Uniqlo.</p>}
    {detailQuery.isError && <div className="product-history-error inline-error" role="alert">
      <h2>Price history couldn’t load</h2><p>The product link still works.</p>
      <button type="button" className="secondary-button" disabled={detailQuery.isFetching}
        onClick={() => { void detailQuery.refetch() }}>{detailQuery.isFetching ? 'Retrying…' : 'Retry price history'}</button>
    </div>}
    {detailQuery.isPending && <div className="product-page-history product-page-chart-loading" role="status">
      <div className="skeleton chart-skeleton" aria-hidden="true" /><p>Loading price history…</p>
    </div>}
    {detailQuery.data && <section className="product-page-history" aria-label="Recorded price history">
      <Suspense fallback={<div className="product-page-chart-loading" role="status"><div className="skeleton chart-skeleton" aria-hidden="true" /><p>Loading price chart…</p></div>}>
        <PriceHistory datapoints={detailQuery.data.datapoints} typicalPrice={detailQuery.data.regular_price} />
      </Suspense>
      <Link className="product-comparison-link" to="/faq#price-comparisons">How prices are compared</Link>
    </section>}
  </div>
}
