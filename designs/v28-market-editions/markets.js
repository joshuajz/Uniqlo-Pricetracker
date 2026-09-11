const MARKET_DATA = {
  CA: { name: 'Canada', flag: '🇨🇦', currency: 'CAD', currencyMark: 'C$', locale: 'en-CA', tax: 'Prices before applicable tax', source: 'uniqlo.com/ca', updated: 'Updated today at 8:42 AM ET' },
  US: { name: 'United States', flag: '🇺🇸', currency: 'USD', currencyMark: 'US$', locale: 'en-US', tax: 'Prices before applicable tax', source: 'uniqlo.com/us', updated: 'Updated today at 8:36 AM ET' },
  GB: { name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', currencyMark: '£', locale: 'en-GB', tax: 'VAT included in displayed prices', source: 'uniqlo.com/uk', updated: 'Updated today at 1:29 PM BST' },
  JP: { name: 'Japan', flag: '🇯🇵', currency: 'JPY', currencyMark: '¥', locale: 'ja-JP', tax: 'Consumption tax included', source: 'uniqlo.com/jp', updated: 'Updated today at 9:18 PM JST' }
}

const readMarket = () => {
  try { return localStorage.getItem('simple-market') || 'CA' } catch { return 'CA' }
}

const formatPrice = (value, market) => new Intl.NumberFormat(market.locale, {
  style: 'currency',
  currency: market.currency,
  maximumFractionDigits: market.currency === 'JPY' ? 0 : 2
}).format(Number(value))

function applyMarket(code) {
  const market = MARKET_DATA[code] || MARKET_DATA.CA
  try { localStorage.setItem('simple-market', code) } catch {}

  document.querySelectorAll('[data-market-option]').forEach(option => {
    const active = option.dataset.marketOption === code
    option.classList.toggle('active', active)
    option.setAttribute('aria-checked', String(active))
  })
  document.querySelectorAll('[data-flag]').forEach(node => { node.textContent = market.flag })
  document.querySelectorAll('[data-country]').forEach(node => { node.textContent = market.name })
  document.querySelectorAll('[data-currency]').forEach(node => { node.textContent = market.currency })
  document.querySelectorAll('[data-currency-mark]').forEach(node => { node.textContent = market.currencyMark })
  document.querySelectorAll('[data-tax]').forEach(node => { node.textContent = market.tax })
  document.querySelectorAll('[data-source]').forEach(node => { node.textContent = market.source })
  document.querySelectorAll('[data-updated]').forEach(node => { node.textContent = market.updated })
  document.querySelectorAll('[data-local-price]').forEach(node => {
    const value = node.dataset[code.toLowerCase()]
    if (value) node.textContent = formatPrice(value, market)
  })
  const dynamicTitle = document.querySelector('[data-page-title]')
  if (dynamicTitle) document.title = `${dynamicTitle.dataset.pageTitle} ${market.name} | Uniqlo Price Tracker`
  closePicker()
}

const overlay = document.querySelector('.market-overlay')
function openPicker() {
  overlay?.classList.add('open')
  document.body.classList.add('picker-open')
  overlay?.querySelector('.market-option.active')?.focus()
}
function closePicker() {
  overlay?.classList.remove('open')
  document.body.classList.remove('picker-open')
}

document.querySelectorAll('[data-open-picker]').forEach(button => button.addEventListener('click', openPicker))
document.querySelectorAll('[data-close-picker]').forEach(button => button.addEventListener('click', closePicker))
document.querySelectorAll('[data-market-option]').forEach(option => option.addEventListener('click', () => applyMarket(option.dataset.marketOption)))
overlay?.addEventListener('click', event => { if (event.target === overlay) closePicker() })
document.addEventListener('keydown', event => { if (event.key === 'Escape') closePicker() })

document.querySelectorAll('[data-chip]').forEach(chip => chip.addEventListener('click', () => {
  chip.parentElement.querySelectorAll('[data-chip]').forEach(item => item.classList.remove('active'))
  chip.classList.add('active')
}))

document.querySelectorAll('[data-period]').forEach(period => period.addEventListener('click', () => {
  period.parentElement.querySelectorAll('[data-period]').forEach(item => item.classList.remove('active'))
  period.classList.add('active')
}))

document.querySelector('[data-watch]')?.addEventListener('click', event => {
  const button = event.currentTarget
  const watching = button.getAttribute('aria-pressed') === 'true'
  button.setAttribute('aria-pressed', String(!watching))
  button.textContent = watching ? 'Notify me' : 'Alert created ✓'
})

applyMarket(readMarket())
