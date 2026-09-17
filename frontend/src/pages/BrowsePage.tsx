import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Grid2X2, List, Search, SlidersHorizontal, X } from 'lucide-react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useProducts, productDetailOptions } from '../data/api'
import { track } from '../lib/analytics'
import {
  DEPARTMENTS, PAGE_SIZE, categoryFilterPresentation, categoryLabel, departmentHasCategory, departmentsLabel, discountPct,
  filterProducts, formatRecordingDate, isLowestRecorded, isOnSale, money, productCategory, productFacets,
  readBrowseFilters, recordingAge, recordingStatus,
} from '../lib/products'
import type { BrowseFilters, ProductSort } from '../lib/products'
import type { Product } from '../types/types'
import ProductImage from '../components/ProductImage'
import PageLoader from '../components/PageLoader'
import ApiErrorFallback from '../components/ApiErrorFallback'

interface CategoryFilterOption { key: string; label: string; values: string[]; count: number }

function toggleValues(current: string[], values: string[]) {
  const active = values.some(value => current.includes(value))
  return active ? current.filter(value => !values.includes(value)) : [...new Set([...current, ...values])]
}

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
  const defaultSort: ProductSort = dealsOnly ? 'discount' : 'name'
  const filters = useMemo(() => readBrowseFilters(params, defaultSort), [params, defaultSort])
  const deferredQuery = useDeferredValue(filters.query)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [mobileFilters, setMobileFilters] = useState(() => window.matchMedia('(max-width: 650px)').matches)
  const browseControlsRef = useRef<HTMLDivElement>(null)
  const filterTriggerRef = useRef<HTMLButtonElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const filterCloseRef = useRef<HTMLButtonElement>(null)
  const firstNewResult = useRef<number | null>(null)
  const filterScroll = useRef<number | null>(null)
  const resultsRef = useRef<HTMLUListElement>(null)
  const query = useProducts()
  const queryClient = useQueryClient()
  const location = useLocation()
  const products = query.data?.products ?? []
  const filtered = useMemo(() => filterProducts(products, { ...filters, query: deferredQuery }, dealsOnly),
    [products, filters, deferredQuery, dealsOnly])
  const facetBase = useMemo(() => filterProducts(products, {
    ...filters, query: deferredQuery, categories: [], tags: [], lowestOnly: false,
  }, dealsOnly), [products, filters, deferredQuery, dealsOnly])
  const categoryOptions = useMemo(() => {
    const options = new Map<string, CategoryFilterOption>()
    facetBase.forEach(product => {
      const productGroups = new Set<string>()
      product.categories
        .filter(path => filters.department === 'all' || path.startsWith(`${filters.department}/`))
        .map(path => path.split('/').slice(1).join('/')).filter(Boolean)
        .forEach(category => {
          const presentation = categoryFilterPresentation(category)
          const option = options.get(presentation.key) ?? { ...presentation, count: 0 }
          if (!productGroups.has(presentation.key)) option.count += 1
          productGroups.add(presentation.key)
          options.set(presentation.key, option)
        })
    })
    filters.categories.forEach(category => {
      const presentation = categoryFilterPresentation(category)
      if (!options.has(presentation.key)) options.set(presentation.key, { ...presentation, count: 0 })
    })
    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [facetBase, filters.department, filters.categories])
  const tagBase = useMemo(() => filterProducts(products, {
    ...filters, query: deferredQuery, tags: [], lowestOnly: false,
  }, dealsOnly), [products, filters, deferredQuery, dealsOnly])
  const tagGroups = useMemo(() => {
    const groups = new Map<string, Map<string, number>>([
      ['Material', new Map()], ['Feature', new Map()],
    ])
    tagBase.forEach(product => productFacets(product).forEach(facet => {
      const counts = groups.get(facet.group)!
      counts.set(facet.label, (counts.get(facet.label) ?? 0) + 1)
    }))
    return [...groups].map(([group, counts]) => ({
      group, tags: [...counts].sort(([, a], [, b]) => b - a),
    }))
  }, [tagBase])
  const selectedCategoryOptions = categoryOptions.filter(option => option.values.some(value => filters.categories.includes(value)))
  const activeFilterCount = selectedCategoryOptions.length + filters.tags.length + Number(filters.lowestOnly)
  const hasFilters = !!filters.query || filters.department !== 'all' || activeFilterCount > 0
  const staleDays = recordingAge(query.data?.datetime)
  const filterModalActive = filtersOpen && mobileFilters

  useEffect(() => {
    const media = window.matchMedia('(max-width: 650px)')
    const update = () => setMobileFilters(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  function closeFilters(restoreFocus = false) {
    setFiltersOpen(false)
    if (restoreFocus) requestAnimationFrame(() => filterTriggerRef.current?.focus())
  }

  useEffect(() => {
    if (!filtersOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!browseControlsRef.current?.contains(event.target as Node)) closeFilters(true)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeFilters(true)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [filtersOpen])

  useEffect(() => {
    if (!filterModalActive) return
    const nav = document.querySelector<HTMLElement>('.site-nav')
    const footer = document.querySelector<HTMLElement>('.site-footer')
    const skipLink = document.querySelector<HTMLElement>('.skip-link')
    const previousOverflow = document.body.style.overflow
    skipLink?.setAttribute('inert', '')
    nav?.setAttribute('inert', '')
    footer?.setAttribute('inert', '')
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => filterCloseRef.current?.focus())

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const focusable = [...(filterPanelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter(element => element.getClientRects().length > 0 && !element.closest('[inert]'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !filterPanelRef.current?.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trapFocus)
    return () => {
      skipLink?.removeAttribute('inert')
      nav?.removeAttribute('inert')
      footer?.removeAttribute('inert')
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', trapFocus)
    }
  }, [filterModalActive])

  useLayoutEffect(() => {
    if (firstNewResult.current === null) return
    resultsRef.current?.children[firstNewResult.current]?.querySelector<HTMLElement>('.product-row')?.focus({ preventScroll: true })
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
      for (const key of ['open', 'q', 'department', 'category', 'tag', 'lowest', 'sort', 'view', 'limit']) search.delete(key)
      if (next.query) search.set('q', next.query)
      if (next.department !== 'all') search.set('department', next.department)
      next.categories.forEach(category => search.append('category', category))
      next.tags.forEach(tag => search.append('tag', tag))
      if (next.lowestOnly) search.set('lowest', '1')
      if (next.sort !== defaultSort) search.set('sort', next.sort)
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
  }

  function prepareProduct(productId: string) {
    void queryClient.prefetchQuery(productDetailOptions(productId))
  }

  const allSearch = new URLSearchParams(params)
  allSearch.delete('modal')
  allSearch.delete('limit')

  const legacyProductId = params.get('modal')
  if (legacyProductId) {
    const legacySearch = new URLSearchParams(params)
    legacySearch.delete('modal')
    const legacyOrigin = location.pathname + (legacySearch.size ? `?${legacySearch}` : '')
    return <Navigate replace to={`/products/${encodeURIComponent(legacyProductId)}`}
      state={{ productPageOrigin: legacyOrigin }} />
  }

  return (
    <div className="browse-page page-container">
      <header className="browse-heading volume-heading" inert={filterModalActive}>
        <div className="volume-copy">
          <p className="browse-eyebrow">Uniqlo Canada price tracker</p>
          <h1 tabIndex={-1}>{dealsOnly ? 'Deals, within reach.' : 'All tracked products.'}</h1>
          <p className="browse-intro">{dealsOnly
            ? 'Independent tracker for Uniqlo Canada price drops'
            : 'Search the current Uniqlo Canada catalogue and price history'}
            {query.data?.datetime && <> · Updated <time dateTime={query.data.datetime.slice(0, 10)}>{formatRecordingDate(query.data.datetime, false)}</time></>}</p>
        </div>
        <p className="volume-status"><span aria-hidden="true" />{query.isPending ? 'Loading prices' : query.isError ? 'Update unavailable' : recordingStatus(query.data?.datetime)}</p>
        {staleDays > 1 && <p className="notice" role="status">The latest update is {staleDays} days old. Check Uniqlo for current prices.</p>}
      </header>

      <a className="skip-results-link" href="#product-results" inert={filterModalActive}>Skip filters and go to results</a>
      <div className="browse-controls" ref={browseControlsRef}>
        <div className="search-filter-row" inert={filterModalActive}>
          <label className="sr-only" htmlFor="product-search">Search {dealsOnly ? 'deals' : 'all products'}</label>
          <div className="search-box">
            <Search size={19} aria-hidden="true" />
            <input id="product-search" type="search" placeholder="Search products or product ID"
              value={filters.query} onChange={e => updateFilters({ query: e.target.value }, true)} />
            {filters.query && <button className="icon-button" type="button" aria-label="Clear search"
              onClick={() => { updateFilters({ query: '' }, true); document.getElementById('product-search')?.focus() }}><X size={18} aria-hidden="true" /></button>}
          </div>
          <div className="department-options" role="group" aria-label="Department">
            {DEPARTMENTS.map(department => (
              <button key={department} type="button" aria-pressed={filters.department === department}
                onClick={() => {
                  updateFilters({ department, categories: departmentHasCategory(products, department, filters.categories) ? filters.categories : [] })
                  track('department_filter_changed', { department })
                }}>{categoryLabel(department)}</button>
            ))}
          </div>
          <div className="filter-actions">
            <button ref={filterTriggerRef} className="filter-disclosure" type="button" aria-expanded={filtersOpen}
              aria-controls="browse-filter-panel" onClick={() => setFiltersOpen(open => !open)}>
              <SlidersHorizontal size={16} aria-hidden="true" />
              <span>Filters</span>
              {activeFilterCount > 0 && <span className="filter-count" aria-label={`${activeFilterCount} active`}>{activeFilterCount}</span>}
            </button>
          </div>
        </div>

        {activeFilterCount > 0 && <div className="active-filters" aria-label="Active filters" inert={filterModalActive}>
          {selectedCategoryOptions.map(option => <button type="button" key={option.key}
            onClick={() => updateFilters({ categories: filters.categories.filter(value => !option.values.includes(value)) })}>
            <span>{option.label}</span><X size={14} aria-hidden="true" /></button>)}
          {filters.tags.map(tag => <button type="button" key={tag}
            onClick={() => updateFilters({ tags: filters.tags.filter(value => value !== tag) })}>
            <span>{tag}</span><X size={14} aria-hidden="true" /></button>)}
          {filters.lowestOnly && <button type="button" onClick={() => updateFilters({ lowestOnly: false })}>
            <span>Lowest recorded</span><X size={14} aria-hidden="true" /></button>}
        </div>}

        {filterModalActive && <div className="filter-backdrop" aria-hidden="true" onClick={() => closeFilters(true)} />}
        <div ref={filterPanelRef} className={`filter-panel ${filtersOpen ? 'is-open' : ''}`} id="browse-filter-panel"
          role={filterModalActive ? 'dialog' : undefined} aria-modal={filterModalActive || undefined}
          aria-labelledby={filterModalActive ? 'browse-filter-title' : undefined}
          aria-label={filterModalActive ? undefined : 'Product filters'} hidden={!filtersOpen}>
          <div className="filter-panel-head">
            <h2 id="browse-filter-title">Refine the {filtered.length.toLocaleString('en-CA')} {dealsOnly ? 'deals' : 'products'}</h2>
            <div className="filter-panel-head-actions">
              {dealsOnly && <label className="lowest-corner filter-panel-desktop-action">
                <input type="checkbox" checked={filters.lowestOnly}
                  onChange={event => updateFilters({ lowestOnly: event.target.checked })} />
                <span>Lowest recorded</span>
              </label>}
              <button type="button" className="text-button filter-panel-desktop-action" onClick={() => updateFilters({
                categories: [], tags: [], lowestOnly: false,
              })}>Clear filters</button>
              <button ref={filterCloseRef} type="button" className="icon-button filter-panel-close"
                aria-label="Close filters" onClick={() => closeFilters(true)}><X size={18} aria-hidden="true" /></button>
            </div>
          </div>
          <div className="filter-panel-list-actions">
            {dealsOnly && <label className="lowest-corner">
              <input type="checkbox" checked={filters.lowestOnly}
                onChange={event => updateFilters({ lowestOnly: event.target.checked })} />
              <span>Lowest recorded</span>
            </label>}
            <button type="button" className="text-button" onClick={() => updateFilters({
              categories: [], tags: [], lowestOnly: false,
            })}>Clear filters</button>
          </div>
          <div className="filter-groups">
            <div className="filter-group filter-group-categories">
              <h3>Category</h3>
              <div className="filter-options" role="group" aria-label="Category">
                {categoryOptions.map(option => <button className="facet-option" key={option.key} type="button"
                  aria-pressed={option.values.some(value => filters.categories.includes(value))}
                  onClick={() => updateFilters({ categories: toggleValues(filters.categories, option.values) })}>
                  <span className="facet-check" aria-hidden="true" /><span>{option.label}</span><small>{option.count}</small>
                </button>)}
              </div>
            </div>
            {tagGroups.map(({ group, tags }) => tags.length > 0 && <div className="filter-group" key={group}>
              <h3>{group}</h3>
              <div className="filter-options" role="group" aria-label={group}>
                {tags.map(([tag, count]) => <button className="facet-option" key={tag} type="button" aria-pressed={filters.tags.includes(tag)}
                  onClick={() => updateFilters({ tags: toggleValues(filters.tags, [tag]) })}>
                  <span className="facet-check" aria-hidden="true" /><span>{tag}</span><small>{count}</small>
                </button>)}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      <section id="product-results" tabIndex={-1} aria-label={dealsOnly ? 'Deals' : 'All products'} inert={filterModalActive}>
        <h2 className="sr-only">{dealsOnly ? 'Deal results' : 'Product results'}</h2>
        <div className="results-toolbar">
          <p className="results-context" aria-live="polite" aria-atomic="true">
            <strong>{query.isPending ? 'Loading prices…' : query.isError && !query.data ? 'Prices unavailable'
              : `${filtered.length.toLocaleString('en-CA')} ${dealsOnly ? 'deal' : 'product'}${filtered.length === 1 ? '' : 's'}`}</strong>
          </p>
          <span className="results-freshness">{query.data?.datetime
            ? <>Checked <time dateTime={query.data.datetime.slice(0, 10)}>{formatRecordingDate(query.data.datetime, false)}</time></>
            : 'Canada · CAD'}</span>
          {hasFilters && <button type="button" className="text-button clear-filters" onClick={() => updateFilters({
            query: '', department: 'all', categories: [], tags: [], lowestOnly: false,
          })}>Clear filters</button>}
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
        {query.isPending ? <PageLoader /> : query.isError && !query.data ? <ApiErrorFallback onRetry={() => { void query.refetch() }} /> : <>
          {query.isError && <div className="notice" role="status">Showing the last loaded prices. The latest update couldn't load. <button type="button" className="text-button" onClick={() => { void query.refetch() }}>Try again</button></div>}
          {filtered.length === 0 ? <div className="empty-state">
            <h3>{products.length === 0 ? 'No products recorded yet' : dealsOnly ? 'No matching deals' : 'No matching products'}</h3>
            <p>{products.length === 0 ? 'Check back after the next daily update.' : dealsOnly
              ? 'This item may still be available at its typical price.' : 'Try a shorter name or remove a filter.'}</p>
            <div className="empty-actions">
              {dealsOnly && products.length > 0 && <Link className="primary-button" to={{ pathname: '/categories', search: allSearch.toString() }}>Search all products</Link>}
              {hasFilters && <button className="secondary-button" type="button" onClick={() => updateFilters({
                query: '', department: 'all', categories: [], tags: [], lowestOnly: false,
              })}>Clear search and filters</button>}
            </div>
          </div> : <>
            <ul ref={resultsRef} className={`product-results ${filters.view === 'grid' ? 'product-grid' : 'product-list'}`} aria-busy={filters.query !== deferredQuery}>
              {filtered.slice(0, filters.limit).map(p => <li key={p.product_id}>
                <Link className="product-row" to={`/products/${encodeURIComponent(p.product_id)}`}
                  state={{ product: p, productPageOrigin: location.pathname + location.search }} onClick={() => selectProduct(p)}
                  onPointerEnter={event => { if (event.pointerType === 'mouse') prepareProduct(p.product_id) }}
                  onFocus={() => prepareProduct(p.product_id)}
                  aria-label={productButtonLabel(p)}>
                  <ProductImage id={p.product_id} />
                  <span className="product-info"><span className="product-copy">
                    <span className="product-name">{p.name}</span>
                    <span className="product-meta">{departmentsLabel(p)} · {productCategory(p)}</span>
                    {productFacets(p)[0] && <span className="product-tag">{productFacets(p)[0].label}</span>}
                  </span>
                    {isLowestRecorded(p) ? <span className="low-badge">Lowest recorded</span>
                      : <span className="product-meta">Lowest recorded: {money(p.lowest_price)}</span>}
                  </span>
                  <span className="product-price"><strong>{money(p.price)}</strong>
                    {isOnSale(p) ? <><span className="typical-price"><span>Typical</span>
                      <del aria-label={`Typical tracked price ${money(p.regular_price)}`}>{money(p.regular_price)}</del></span>
                      <span className="discount">{discountPct(p)}% off</span></> : <span className="product-meta">{p.price === p.regular_price ? 'Typical price' : 'Above typical'}</span>}
                  </span><ArrowRight className="product-arrow" size={18} aria-hidden="true" />
                </Link>
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
    </div>
  )
}
