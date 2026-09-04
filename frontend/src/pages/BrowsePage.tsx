import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Grid2X2, List, Search, SlidersHorizontal, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { getProducts, productDetailOptions } from '../data/api'
import { track } from '../lib/analytics'
import {
  PAGE_SIZE, categoryLabel, departmentHasCategory, departmentsLabel, discountPct, filterProducts, formatRecordingDate,
  isLowestRecorded, isOnSale, money, readBrowseFilters, recordingAge,
} from '../lib/products'
import type { BrowseFilters, Department, ProductSort } from '../lib/products'
import type { Product } from '../types/types'
import { useProductModal } from '../hooks/useProductModal'
import ProductModal from '../components/ProductModal'
import ProductImage from '../components/ProductImage'
import PageLoader from '../components/PageLoader'
import ApiErrorFallback from '../components/ApiErrorFallback'

function productButtonLabel(product: Product) {
  const details = [
    `View price history for ${product.name}`,
    departmentsLabel(product),
    `Current price ${money(product.price)} CAD`,
  ]
  if (isOnSale(product)) {
    details.push(`Typical tracked price ${money(product.regular_price)} CAD`, `${discountPct(product)}% off`)
  } else {
    details.push(product.price === product.regular_price ? 'At the typical tracked price' : 'Above the typical tracked price')
  }
  details.push(isLowestRecorded(product) ? 'Lowest recorded price' : `Lowest recorded price ${money(product.lowest_price)} CAD`)
  return details.join('. ')
}

export default function BrowsePage({ dealsOnly }: { dealsOnly: boolean }) {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readBrowseFilters(params), [params])
  const deferredQuery = useDeferredValue(filters.query)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const firstNewResult = useRef<number | null>(null)
  const filterScroll = useRef<number | null>(null)
  const resultsRef = useRef<HTMLUListElement>(null)
  const query = getProducts()
  const queryClient = useQueryClient()
  const { modalId, openModal, closeModal } = useProductModal()
  const products = query.data?.products ?? []
  const filtered = useMemo(() => filterProducts(products, { ...filters, query: deferredQuery }, dealsOnly),
    [products, filters, deferredQuery, dealsOnly])
  const categories = useMemo(() => [...new Set(products.flatMap(p => p.categories)
    .filter(c => filters.department === 'all' || c.startsWith(`${filters.department}/`))
    .map(c => c.split('/').slice(1).join('/')).filter(Boolean))].sort(), [products, filters.department])
  const visibleCategories = filters.category !== 'all' && !categories.includes(filters.category)
    ? [...categories, filters.category] : categories
  const activeFilterCount = Number(filters.category !== 'all') + Number(filters.lowestOnly)
  const hiddenFilterCount = Number(filters.lowestOnly)
  const hasFilters = !!filters.query || filters.department !== 'all' || activeFilterCount > 0
  const staleDays = recordingAge(query.data?.datetime)

  useLayoutEffect(() => {
    if (firstNewResult.current === null) return
    resultsRef.current?.children[firstNewResult.current]?.querySelector('button')?.focus({ preventScroll: true })
    firstNewResult.current = null
  }, [filters.limit])

  useEffect(() => {
    if (filterScroll.current === null) return
    const position = filterScroll.current
    filterScroll.current = null
    let secondFrame = 0
    const restore = () => window.scrollTo(0, position)
    const frame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(restore) })
    const timer = window.setTimeout(restore, 120)
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); window.clearTimeout(timer) }
  }, [params])

  function updateFilters(patch: Partial<BrowseFilters>, replace = false, preserveLimit = false) {
    filterScroll.current = window.scrollY
    const next = { ...filters, limit: preserveLimit ? filters.limit : PAGE_SIZE, ...patch }
    setParams(previous => {
      const search = new URLSearchParams(previous)
      for (const key of ['open', 'q', 'department', 'category', 'lowest', 'sort', 'view', 'limit']) search.delete(key)
      if (next.query) search.set('q', next.query)
      if (next.department !== 'all') search.set('department', next.department)
      if (next.category !== 'all') search.set('category', next.category)
      if (next.lowestOnly) search.set('lowest', '1')
      if (next.sort !== 'discount') search.set('sort', next.sort)
      if (next.view !== 'grid') search.set('view', next.view)
      if (next.limit > PAGE_SIZE) search.set('limit', String(next.limit))
      return search
    }, { replace, state: null })
  }

  useEffect(() => {
    if (!filters.query.trim()) return
    const timer = window.setTimeout(() => track(dealsOnly ? 'home_search' : 'categories_search', {
      query: filters.query.trim(), results_count: filtered.length,
    }), 600)
    return () => window.clearTimeout(timer)
  }, [filters.query, filtered.length, dealsOnly])

  function selectProduct(p: Product) {
    track('product_clicked', {
      product_id: p.product_id, product_name: p.name, price: p.price,
      discount_pct: discountPct(p), is_atl: isLowestRecorded(p), is_on_sale: isOnSale(p),
      source: dealsOnly ? 'home' : 'categories',
    })
    openModal(p.product_id)
  }

  function prepareProduct(productId: string) {
    void queryClient.prefetchQuery(productDetailOptions(productId))
  }

  const allSearch = new URLSearchParams(params)
  allSearch.delete('modal')
  allSearch.delete('limit')

  return (
    <div className="browse-page page-container">
      <header className="browse-heading">
        <h1 tabIndex={-1}>Uniqlo <span>Tracker</span></h1>
        <p className="browse-intro">Compare today's prices with their history.</p>
        <p className="recording-note">Canada · All prices in CAD
          {query.data?.datetime && <> · Prices checked <time dateTime={query.data.datetime.slice(0, 10)}>{formatRecordingDate(query.data.datetime)}</time></>}
        </p>
        {staleDays > 1 && <p className="notice" role="status">The latest update is {staleDays} days old. Check Uniqlo for current prices.</p>}
      </header>

      <div className="browse-controls">
        <label className="search-label" htmlFor="product-search">Search {dealsOnly ? 'deals' : 'all products'}</label>
        <div className="search-box">
          <Search size={19} aria-hidden="true" />
          <input id="product-search" type="search" placeholder="Product name or product ID"
            value={filters.query} onChange={e => updateFilters({ query: e.target.value }, true)} />
          {filters.query && <button className="icon-button" type="button" aria-label="Clear search"
            onClick={() => { updateFilters({ query: '' }, true); document.getElementById('product-search')?.focus() }}><X size={18} aria-hidden="true" /></button>}
        </div>
        <div className="filter-row">
          <div className="department-options" role="group" aria-label="Department">
            {(['all', 'women', 'men', 'kids'] as Department[]).map(department => (
              <button key={department} type="button" aria-pressed={filters.department === department}
                onClick={() => {
                  updateFilters({ department, category: departmentHasCategory(products, department, filters.category) ? filters.category : 'all' })
                  track('department_filter_changed', { department })
                }}>{categoryLabel(department)}</button>
            ))}
          </div>
          <div className="desktop-additional-filters">
            <label className="check-label"><input type="checkbox" checked={filters.lowestOnly}
              onChange={e => updateFilters({ lowestOnly: e.target.checked })} />Lowest recorded only</label>
          </div>
        </div>
        {visibleCategories.length > 0 && <>
          <div className="category-options" role="group" aria-label="Category">
            <button type="button" aria-pressed={filters.category === 'all'}
              onClick={() => updateFilters({ category: 'all' })}>All categories</button>
            {visibleCategories.map(category => <button key={category} type="button"
              aria-pressed={filters.category === category}
              onClick={() => updateFilters({ category })}>{categoryLabel(category)}</button>)}
          </div>
          <label className="mobile-category-control" htmlFor="mobile-category-select"><span>Category</span>
            <select id="mobile-category-select" value={filters.category}
              onChange={e => updateFilters({ category: e.target.value })}>
              <option value="all">All categories</option>
              {visibleCategories.map(category => <option key={category} value={category}>{categoryLabel(category)}</option>)}
            </select>
          </label>
        </>}
        {hasFilters && <div className="active-filters" aria-label="Active filters">
          {filters.department !== 'all' && <span>{categoryLabel(filters.department)}</span>}
          {filters.category !== 'all' && <span>{categoryLabel(filters.category)}</span>}
          {filters.lowestOnly && <span>Lowest recorded only</span>}
          <button type="button" className="text-button" onClick={() => updateFilters({
            query: '', department: 'all', category: 'all', lowestOnly: false,
          })}>Clear search and filters</button>
        </div>}
      </div>

      <section aria-label={dealsOnly ? 'Deals' : 'All products'}>
        <div className="results-toolbar">
          <h2 className="result-count" aria-live="polite" aria-atomic="true">
            {query.isPending ? 'Loading products…' : query.isError && !query.data ? 'Products unavailable'
              : `${filtered.length.toLocaleString('en-CA')} ${dealsOnly ? 'deal' : 'product'}${filtered.length === 1 ? '' : 's'}`}
          </h2>
          <button type="button" className="filter-toggle secondary-button" aria-expanded={filtersOpen}
            aria-controls="mobile-additional-filters" onClick={() => setFiltersOpen(open => !open)}>
            <SlidersHorizontal size={15} aria-hidden="true" />Filters{hiddenFilterCount > 0 ? ` (${hiddenFilterCount})` : ''}
          </button>
          <label className="sort-label"><span>Sort by</span>
            <select aria-label="Sort products" value={filters.sort} onChange={e => {
              updateFilters({ sort: e.target.value as ProductSort })
              track('categories_sort_changed', { sort_key: e.target.value })
            }}>
              <option value="discount">Biggest discount</option><option value="price">Price: low to high</option><option value="name">Name: A to Z</option>
            </select>
          </label>
          <div className="view-options" role="group" aria-label="Product view">
            <button className="icon-button" type="button" aria-label="List view" aria-pressed={filters.view === 'list'}
              onClick={() => updateFilters({ view: 'list' }, false, true)}><List size={18} aria-hidden="true" /></button>
            <button className="icon-button" type="button" aria-label="Grid view" aria-pressed={filters.view === 'grid'}
              onClick={() => updateFilters({ view: 'grid' }, false, true)}><Grid2X2 size={18} aria-hidden="true" /></button>
          </div>
        </div>
        <div id="mobile-additional-filters" className={`mobile-additional-filters ${filtersOpen ? 'is-open' : ''}`}>
          <label className="check-label"><input type="checkbox" checked={filters.lowestOnly}
            onChange={e => updateFilters({ lowestOnly: e.target.checked })} />Lowest recorded only</label>
        </div>
        {query.isPending ? <PageLoader /> : query.isError && !query.data ? <ApiErrorFallback onRetry={() => { void query.refetch() }} /> : <>
          {query.isError && <div className="notice" role="status">Showing the last loaded prices. The latest update couldn't load. <button type="button" className="text-button" onClick={() => { void query.refetch() }}>Try again</button></div>}
          {filtered.length === 0 ? <div className="empty-state">
            <h3>{products.length === 0 ? 'No products recorded yet' : dealsOnly ? 'No matching deals' : 'No matching products'}</h3>
            <p>{products.length === 0 ? 'Check back after the next daily update.' : dealsOnly
              ? 'This item may still be available at its typical price.' : 'Try a shorter name or remove a filter.'}</p>
            <div className="empty-actions">
              {dealsOnly && products.length > 0 && <Link className="primary-button" to={{ pathname: '/categories', search: allSearch.toString() }}>Search all products</Link>}
              {hasFilters && <button className="secondary-button" type="button" onClick={() => updateFilters({
                query: '', department: 'all', category: 'all', lowestOnly: false,
              })}>Clear search and filters</button>}
            </div>
          </div> : <>
            <ul ref={resultsRef} className={`product-results ${filters.view === 'grid' ? 'product-grid' : 'product-list'}`} aria-busy={filters.query !== deferredQuery}>
              {filtered.slice(0, filters.limit).map(p => <li key={p.product_id}>
                <button type="button" className="product-row" onClick={() => selectProduct(p)}
                  onPointerEnter={event => { if (event.pointerType === 'mouse') prepareProduct(p.product_id) }}
                  onFocus={() => prepareProduct(p.product_id)}
                  aria-label={productButtonLabel(p)}>
                  <ProductImage id={p.product_id} />
                  <span className="product-info"><span className="product-name">{p.name}</span>
                    <span className="product-meta">{departmentsLabel(p)}</span>
                    {isLowestRecorded(p) ? <span className="low-badge">Lowest recorded</span>
                      : <span className="product-meta">Lowest recorded: {money(p.lowest_price)}</span>}
                  </span>
                  <span className="product-price"><strong>{money(p.price)}</strong>
                    {isOnSale(p) ? <><del aria-label={`Typical tracked price ${money(p.regular_price)}`}>{money(p.regular_price)}</del>
                      <span className="discount">{discountPct(p)}% off</span></> : <span className="product-meta">{p.price === p.regular_price ? 'Typical price' : 'Above typical'}</span>}
                  </span><ArrowRight className="product-arrow" size={18} aria-hidden="true" />
                </button>
              </li>)}
            </ul>
            <div className="load-more"><p>Showing {Math.min(filters.limit, filtered.length)} of {filtered.length} {dealsOnly ? 'deal' : 'product'}{filtered.length === 1 ? '' : 's'}</p>
              {filters.limit < filtered.length && <button className="secondary-button" type="button" onClick={() => {
                firstNewResult.current = filters.limit
                updateFilters({ limit: filters.limit + PAGE_SIZE }, true, true)
              }}>
                Show {Math.min(PAGE_SIZE, filtered.length - filters.limit)} more
              </button>}
            </div>
          </>}
          <p className="price-basis">{dealsOnly
            ? 'Deals are below the most frequently recorded price. '
            : 'Price comparisons use the most frequently recorded price. '}
            <Link to="/faq#price-comparisons">How price comparisons work</Link>
          </p>
        </>}
      </section>
      {modalId && <ProductModal key={modalId} productId={modalId} product={products.find(p => p.product_id === modalId)}
        archived={!!query.data && !products.some(p => p.product_id === modalId)} onClose={closeModal} />}
    </div>
  )
}
