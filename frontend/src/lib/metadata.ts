export const SITE_URL = 'https://www.uniqlotracker.com'
export interface PageMetadata { title: string; description: string; url: string; image: string; noindex: boolean }
export interface MetadataProduct { product_id: string; name: string; price: number }

export function pageMetadata(pathname: string, product?: MetadataProduct, missing = false): PageMetadata {
  const path = pathname === '/dashboard' ? '/' : pathname
  const productRoute = /^\/products\/[^/]+$/.test(path)
  let title = path === '/' ? 'Deals' : path === '/categories' ? 'All products' : path === '/faq' ? 'FAQ' : productRoute ? 'Product price history' : 'Page not found'
  let description = path === '/categories' ? 'Browse the current Uniqlo Canada catalogue and compare daily recorded prices in CAD.'
    : path === '/faq' ? 'How Uniqlo Price Tracker records Canadian prices, calculates deals, and compares price history.'
    : 'Track Uniqlo Canada prices, browse deals, and compare daily recorded price history in CAD.'
  if (productRoute && product) {
    title = product.name
    const price = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(product.price)
    description = `${product.name}: last recorded price ${price} CAD. Compare its daily Uniqlo Canada price history and check availability on Uniqlo.`
  }
  if (missing) { title = 'Product not found'; description = 'This product has no recorded price history.' }
  return { title: `${title} | Uniqlo Price Tracker Canada`, description, url: SITE_URL + path,
    image: `${SITE_URL}/social-card.png`, noindex: missing || (!productRoute && !['/', '/categories', '/faq'].includes(path)) }
}

export function applyMetadata(metadata: PageMetadata) {
  document.title = metadata.title
  const set = (selector: string, value: string) => document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', value)
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', metadata.url)
  set('meta[name="description"]', metadata.description)
  set('meta[property="og:url"]', metadata.url)
  for (const key of ['og:title', 'twitter:title']) set(`meta[${key.startsWith('og:') ? 'property' : 'name'}="${key}"]`, metadata.title)
  for (const key of ['og:description', 'twitter:description']) set(`meta[${key.startsWith('og:') ? 'property' : 'name'}="${key}"]`, metadata.description)
  set('meta[name="robots"]', metadata.noindex ? 'noindex,follow' : 'index,follow')
}

const escapeHTML = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Render these into the initial response so sharing crawlers need no JavaScript.
export function renderMetadata(html: string, metadata: PageMetadata) {
  const title = escapeHTML(metadata.title)
  const description = escapeHTML(metadata.description)
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`)
  const values: Record<string, string> = { description, 'og:url': escapeHTML(metadata.url), 'og:title': title,
    'twitter:title': title, 'og:description': description, 'twitter:description': description,
    robots: metadata.noindex ? 'noindex,follow' : 'index,follow' }
  for (const [key, value] of Object.entries(values)) {
    html = html.replace(new RegExp(`<meta (?:name|property)="${key}" content="[^"]*"\\s*/?>`), match => match.replace(/content="[^"]*"/, () => `content="${value}"`))
  }
  return html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, () => `<link rel="canonical" href="${escapeHTML(metadata.url)}" />`)
}
