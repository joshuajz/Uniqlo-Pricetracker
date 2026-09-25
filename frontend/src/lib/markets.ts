export const MARKETS = [
  { code: 'CA', slug: 'ca', name: 'Canada', currency: 'CAD', locale: 'en-CA', tax: 'before tax' },
  { code: 'US', slug: 'us', name: 'United States', currency: 'USD', locale: 'en-US', tax: 'before tax' },
  { code: 'GB', slug: 'uk', name: 'United Kingdom', currency: 'GBP', locale: 'en-GB', tax: 'VAT included' },
  { code: 'JP', slug: 'jp', name: 'Japan', currency: 'JPY', locale: 'en-JP', tax: 'tax included' },
] as const

export type Market = typeof MARKETS[number]
export const DEFAULT_MARKET = MARKETS[0]
export const MARKET_STORAGE_KEY = 'uniqlo-market'

export function findMarket(value: string | null | undefined): Market | undefined {
  const key = value?.toLowerCase()
  return MARKETS.find(market => market.slug === key || market.code.toLowerCase() === key)
}

export function splitMarketPath(pathname: string) {
  const [, segment, ...rest] = pathname.split('/')
  const market = findMarket(segment)
  return { market, path: market ? '/' + rest.join('/').replace(/\/$/, '') : pathname }
}

export const marketPath = (market: Market, path = '/') => `/${market.slug}${path === '/' ? '' : path}`
export const money = (value: number, market: Market = DEFAULT_MARKET) => new Intl.NumberFormat(market.locale, {
  style: 'currency', currency: market.currency,
}).format(value)

export function rememberedMarket(): Market {
  try { return findMarket(localStorage.getItem(MARKET_STORAGE_KEY)) ?? DEFAULT_MARKET } catch { return DEFAULT_MARKET }
}

export function rememberMarket(market: Market) {
  try { localStorage.setItem(MARKET_STORAGE_KEY, market.slug) } catch { /* URLs still work when storage is unavailable. */ }
}

// Product IDs and category filters are not portable between storefronts.
export function switchedMarketPath(pathname: string, market: Market) {
  const { path } = splitMarketPath(pathname)
  return marketPath(market, path.startsWith('/products/') ? '/categories' : path)
}

// Old unprefixed links were all Canadian. Only the bare home URL uses a preference.
export function legacyDestination(pathname: string, preferred: Market = DEFAULT_MARKET, search = '') {
  return marketPath(pathname === '/' && !new URLSearchParams(search).has('modal') ? preferred : DEFAULT_MARKET, pathname === '/dashboard' ? '/' : pathname)
}
