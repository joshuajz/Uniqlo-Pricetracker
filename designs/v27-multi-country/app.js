const markets = {
  CA: { flag: '🇨🇦', name: 'Canada', currency: 'CAD', tax: 'Before tax', locale: 'en-CA' },
  US: { flag: '🇺🇸', name: 'United States', currency: 'USD', tax: 'Before tax', locale: 'en-US' },
  GB: { flag: '🇬🇧', name: 'United Kingdom', currency: 'GBP', tax: 'VAT included', locale: 'en-GB' },
  JP: { flag: '🇯🇵', name: 'Japan', currency: 'JPY', tax: 'Tax included', locale: 'ja-JP' }
}

const marketButtons = () => document.querySelectorAll('[data-market]')
const storedMarket = () => {
  try { return localStorage.getItem('upt-market') || 'CA' } catch { return 'CA' }
}

function setMarket(code) {
  const market = markets[code] || markets.CA
  try { localStorage.setItem('upt-market', code) } catch {}

  marketButtons().forEach(button => {
    const isActive = button.dataset.market === code
    button.classList.toggle('active', isActive)
    if (button.classList.contains('market-card')) {
      button.classList.toggle('current', isActive)
      const tag = button.querySelector('.tag')
      if (tag) {
        tag.textContent = isActive ? 'Selected' : 'Live'
        tag.classList.toggle('red', isActive)
      }
    }
    button.setAttribute('aria-pressed', String(isActive))
  })

  document.querySelectorAll('[data-active-flag]').forEach(node => { node.textContent = market.flag })
  document.querySelectorAll('[data-active-market]').forEach(node => { node.textContent = market.name })
  document.querySelectorAll('[data-active-code]').forEach(node => { node.textContent = `${code} · ${market.currency}` })
  document.querySelectorAll('[data-active-currency]').forEach(node => { node.textContent = market.currency })
  document.querySelectorAll('[data-tax-basis]').forEach(node => { node.textContent = market.tax })

  document.querySelectorAll('[data-price-set]').forEach(node => {
    const value = Number(node.dataset[code.toLowerCase()])
    if (!Number.isNaN(value)) {
      node.textContent = new Intl.NumberFormat(market.locale, { style: 'currency', currency: market.currency, maximumFractionDigits: code === 'JP' ? 0 : 2 }).format(value)
    }
  })

  document.querySelectorAll('[data-market-row]').forEach(row => row.classList.toggle('active-market', row.dataset.marketRow === code))
  document.querySelector('.mobile-market-picker')?.classList.remove('open')
}

marketButtons().forEach(button => button.addEventListener('click', () => setMarket(button.dataset.market)))

const picker = document.querySelector('.mobile-market-picker')
document.querySelector('.mobile-market-trigger')?.addEventListener('click', () => picker?.classList.add('open'))
document.querySelector('[data-close-picker]')?.addEventListener('click', () => picker?.classList.remove('open'))
picker?.addEventListener('click', event => { if (event.target === picker) picker.classList.remove('open') })

document.querySelectorAll('[data-chip]').forEach(chip => chip.addEventListener('click', () => {
  chip.parentElement.querySelectorAll('[data-chip]').forEach(item => item.classList.remove('active'))
  chip.classList.add('active')
}))

document.querySelectorAll('[data-alert]').forEach(button => button.addEventListener('click', () => {
  const enabled = button.getAttribute('aria-pressed') === 'true'
  button.setAttribute('aria-pressed', String(!enabled))
  button.textContent = enabled ? 'Track this product' : 'Tracking in 4 markets ✓'
}))

setMarket(storedMarket())
