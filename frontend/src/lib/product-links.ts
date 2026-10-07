import { findMarket, marketPath, type Market } from './markets.ts'

export interface ProductLink {
  market: Market
  productId: string
  historyPath: string
  retailerUrl: string
}

// Keep the edition suffix: E123456-000 and E123456-001 are distinct records.
export function productLinkFromPath(pathname: string): ProductLink | undefined {
  const match = pathname.match(/^\/(ca|us|uk|gb|jp)\/(en|fr|ja)\/products\/(E\d{6,7}-\d{3})(?:\/(\d{2}))?\/?$/i)
  if (!match) return undefined
  const market = findMarket(match[1])!
  const productId = match[3].toUpperCase()
  return {
    market, productId,
    historyPath: marketPath(market, `/products/${productId}`),
    retailerUrl: `https://www.uniqlo.com/${market.slug}/${match[2].toLowerCase()}/products/${productId}/${match[4] ?? '00'}`,
  }
}

export function looksLikeProductLink(value: string) {
  return /^(?:https?:|www\.|(?:uniqlo|uniqlotracker)\.com(?:\/|$))/i.test(value.trim())
}

export function parseProductLink(value: string): ProductLink {
  const text = value.trim()
  let url: URL
  try { url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`) }
  catch { throw new Error('Paste the complete product link from Uniqlo, including the country and product ID.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port
    || !['uniqlo.com', 'www.uniqlo.com', 'uniqlotracker.com', 'www.uniqlotracker.com'].includes(url.hostname)) {
    throw new Error('Use a product link from uniqlo.com or uniqlotracker.com.')
  }
  const country = url.pathname.split('/')[1]
  if (!findMarket(country)) throw new Error('Link lookup supports Canada, the US, the UK, and Japan. Copy a link from one of those stores.')
  const link = productLinkFromPath(url.pathname)
  if (!link) throw new Error('Copy the link from an individual product page. Category and search links don’t identify a product.')
  return link
}

export function retailerUrlForProduct(market: Market, productId: string) {
  if (!/^E\d{6,7}-\d{3}$/.test(productId)) return undefined
  return `https://www.uniqlo.com/${market.slug}/${market.slug === 'jp' ? 'ja' : 'en'}/products/${productId}/00`
}
