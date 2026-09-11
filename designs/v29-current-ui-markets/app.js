const markets = {
  CA:{name:'Canada',flag:'🇨🇦',currency:'CAD',locale:'en-CA',tax:'before tax',source:'Uniqlo Canada'},
  US:{name:'United States',flag:'🇺🇸',currency:'USD',locale:'en-US',tax:'before tax',source:'Uniqlo USA'},
  GB:{name:'United Kingdom',flag:'🇬🇧',currency:'GBP',locale:'en-GB',tax:'VAT included',source:'Uniqlo UK'},
  JP:{name:'Japan',flag:'🇯🇵',currency:'JPY',locale:'ja-JP',tax:'tax included',source:'Uniqlo Japan'}
}

const overlay = document.querySelector('.market-overlay')
const savedMarket = () => { try { return localStorage.getItem('current-ui-market') || 'CA' } catch { return 'CA' } }
const closeMarket = () => { overlay?.classList.remove('open'); document.body.classList.remove('dialog-open') }
const openMarket = () => { overlay?.classList.add('open'); document.body.classList.add('dialog-open'); overlay?.querySelector('.market-option.active')?.focus() }

function selectMarket(code) {
  const market = markets[code] || markets.CA
  try { localStorage.setItem('current-ui-market',code) } catch {}
  document.querySelectorAll('[data-flag]').forEach(node => { node.textContent=market.flag })
  document.querySelectorAll('[data-country]').forEach(node => { node.textContent=market.name })
  document.querySelectorAll('[data-currency]').forEach(node => { node.textContent=market.currency })
  document.querySelectorAll('[data-tax]').forEach(node => { node.textContent=market.tax })
  document.querySelectorAll('[data-source]').forEach(node => { node.textContent=market.source })
  document.querySelectorAll('[data-price]').forEach(node => {
    const value=node.dataset[code.toLowerCase()]
    if(value) node.textContent=new Intl.NumberFormat(market.locale,{style:'currency',currency:market.currency,maximumFractionDigits:market.currency==='JPY'?0:2}).format(Number(value))
  })
  document.querySelectorAll('[data-market-option]').forEach(option => {
    const active=option.dataset.marketOption===code
    option.classList.toggle('active',active)
    option.setAttribute('aria-checked',String(active))
  })
  document.title=`${document.body.dataset.title} | Uniqlo Price Tracker ${market.name}`
  closeMarket()
}

document.querySelectorAll('[data-open-market]').forEach(button => button.addEventListener('click',openMarket))
document.querySelectorAll('[data-close-market]').forEach(button => button.addEventListener('click',closeMarket))
document.querySelectorAll('[data-market-option]').forEach(option => option.addEventListener('click',()=>selectMarket(option.dataset.marketOption)))
overlay?.addEventListener('click',event=>{if(event.target===overlay)closeMarket()})
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMarket()})
document.querySelectorAll('[data-choice]').forEach(button=>button.addEventListener('click',()=>{button.parentElement.querySelectorAll('[data-choice]').forEach(item=>item.classList.remove('active'));button.classList.add('active')}))
selectMarket(savedMarket())
