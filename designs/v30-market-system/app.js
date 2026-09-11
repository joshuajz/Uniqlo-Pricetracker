const markets = {
  CA: { id: 'CA', code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD', locale: 'en-CA', tax: 'before tax', checked: '08:42 ET' },
  US: { id: 'US', code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', locale: 'en-US', tax: 'before tax', checked: '08:36 ET' },
  GB: { id: 'GB', code: 'UK', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', locale: 'en-GB', tax: 'VAT included', checked: '13:29 BST' },
  JP: { id: 'JP', code: 'JP', name: 'Japan', flag: '🇯🇵', currency: 'JPY', locale: 'ja-JP', tax: 'tax included', checked: '21:18 JST' },
}

const products = [
  { id:'469869', name:'PUFFTECH Compact Jacket', dept:'Women', cat:'Outerwear', swatch:'#9fb4ae', drop:'10', low:true, path:['Outerwear','Lightweight jackets'], tags:['PUFFTECH','Packable','Water-repellent'],
    prices:{ CA:[89.90,99.90,89.90], US:[69.90,79.90,59.90], GB:[59.90,69.90,59.90], JP:[5990,6990,4990] } },
  { id:'479000', name:'Wide Straight Jeans', dept:'Women', cat:'Bottoms', swatch:'#8797ac', drop:'33', low:true, path:['Bottoms','Jeans'], tags:['Denim','Wide fit','Full length'],
    prices:{ CA:[39.90,59.90,39.90], US:[29.90,49.90,29.90], GB:[29.90,49.90,29.90], JP:[3990,4990,3990] } },
  { id:'477198', name:'Extra Fine Merino Crew Neck Sweater', dept:'Men', cat:'Knitwear', swatch:'#d1bdac', drop:'33', low:false, path:['Tops','Sweaters'], tags:['Merino wool','Crew neck','Washable'],
    prices:{ CA:[39.90,59.90,29.90], US:[34.90,49.90,24.90], GB:[29.90,39.90,24.90], JP:[3990,4990,2990] } },
  { id:'465185', name:'AIRism Cotton Crew Neck T-Shirt', dept:'Unisex', cat:'Tops', swatch:'#c8cccb', drop:'25', low:true, path:['Tops','T-shirts'], tags:['AIRism','Cotton','Quick dry'],
    prices:{ CA:[14.90,19.90,14.90], US:[9.90,14.90,9.90], GB:[9.90,14.90,9.90], JP:[990,1490,990] } },
  { id:'475034', name:'Utility Short Blouson', dept:'Men', cat:'Outerwear', swatch:'#7d8379', drop:'13', low:false, path:['Outerwear','Short jackets'], tags:['Utility','Relaxed fit','Water-repellent'],
    prices:{ CA:[69.90,79.90,59.90], US:[59.90,69.90,49.90], GB:[59.90,69.90,49.90], JP:[6990,7990,5990] } },
  { id:'476118', name:'Round Mini Shoulder Bag', dept:'Unisex', cat:'Accessories', swatch:'#c6614f', drop:'29', low:true, path:['Accessories','Bags'], tags:['Mini','Shoulder bag','Water-repellent'],
    prices:{ CA:[24.90,34.90,24.90], US:[19.90,29.90,19.90], GB:[19.90,24.90,19.90], JP:[1990,2990,1990] } },
  { id:'472012', name:'Pleated Wide Pants', dept:'Women', cat:'Bottoms', swatch:'#505563', drop:'20', low:false, path:['Bottoms','Trousers'], tags:['Pleated','Wide fit','Full length'],
    prices:{ CA:[39.90,49.90,34.90], US:[39.90,49.90,29.90], GB:[34.90,39.90,29.90], JP:[3990,4990,2990] } },
  { id:'461143', name:'HEATTECH Crew Neck T-Shirt', dept:'Unisex', cat:'Innerwear', swatch:'#664f43', drop:'41', low:true, path:['Innerwear','Base layers'], tags:['HEATTECH','Crew neck','Warm'],
    prices:{ CA:[14.90,24.90,14.90], US:[12.90,19.90,12.90], GB:[12.90,19.90,12.90], JP:[990,1990,990] } },
]

const concepts = [
  { id:'01', slug:'retail-ledger', file:'option-01-retail-ledger.html', family:'Retail / UNIQLO-adjacent', name:'Retail ledger', layout:'ledger', note:'Safest evolution',
    summary:'The current list, tightened around deal scanning. The market stamp replaces repeated country copy.' },
  { id:'02', slug:'campaign-grid', file:'option-02-campaign-grid.html', family:'Retail / UNIQLO-adjacent', name:'Campaign grid', layout:'campaign', note:'Most visual',
    summary:'Large retail imagery and sale typography make deal discovery feel closer to shopping.' },
  { id:'03', slug:'utility-catalogue', file:'option-03-utility-catalogue.html', family:'Retail / UNIQLO-adjacent', name:'Utility catalogue', layout:'catalogue', note:'Highest density',
    summary:'A compact catalogue for people who want to scan many products quickly.' },
  { id:'04', slug:'redline-browse', file:'option-04-redline-browse.html', family:'Retail / UNIQLO-adjacent', name:'Redline browse', layout:'redline', note:'Strongest identity',
    summary:'Horizontal deal strips use discount as the primary visual signal.' },
  { id:'05', slug:'product-focus', file:'option-05-product-focus.html', family:'Retail / UNIQLO-adjacent', name:'Product focus', layout:'split', note:'Best for one item',
    summary:'Search and browse on the left, persistent price detail on the right.' },
  { id:'06', slug:'price-lens', file:'option-06-price-lens.html', family:'Independent brand', name:'Price Lens', layout:'lens', note:'Recommended',
    summary:'A calm price-intelligence brand: distinctive, credible, and easy to extend beyond one retailer.' },
  { id:'07', slug:'drop-board', file:'option-07-drop-board.html', family:'Independent brand', name:'Drop Board', layout:'board', note:'Fastest scan',
    summary:'A transit-board rhythm makes new drops and lows immediately scannable.' },
  { id:'08', slug:'field-cards', file:'option-08-field-cards.html', family:'Independent brand', name:'Field cards', layout:'cards', note:'Friendliest',
    summary:'Soft product tiles balance browsing appeal with trustworthy price context.' },
  { id:'09', slug:'quiet-index', file:'option-09-quiet-index.html', family:'Independent brand', name:'Quiet Index', layout:'index', note:'Most restrained',
    summary:'A typographic index that spends attention only on price movement.' },
  { id:'10', slug:'atlas-compare', file:'option-10-atlas-compare.html', family:'Independent brand', name:'Atlas compare', layout:'compare', note:'Optional comparison',
    summary:'Single-market by default, with an explicit compare view for matched products.' },
  { id:'11', slug:'facet-rail', file:'option-11-facet-rail.html', family:'Scale + granular tags', name:'Facet rail', layout:'facetRail', note:'Recommended for 242',
    summary:'Persistent counted facets narrow a dense two-column stream without hiding the active filter state.' },
  { id:'12', slug:'tag-shelves', file:'option-12-tag-shelves.html', family:'Scale + granular tags', name:'Tag shelves', layout:'tagShelves', note:'Best without sidebar',
    summary:'Three compact tag shelves expose category, material, and feature filters above a six-column mosaic.' },
  { id:'13', slug:'grouped-ledger', file:'option-13-grouped-ledger.html', family:'Scale + granular tags', name:'Grouped ledger', layout:'groupedLedger', note:'Best for orientation',
    summary:'Leaf categories become sticky sections, so tags organize the results instead of repeating on every card.' },
  { id:'14', slug:'compact-mosaic', file:'option-14-compact-mosaic.html', family:'Scale + granular tags', name:'Compact mosaic', layout:'compactMosaic', note:'Most products on screen',
    summary:'Tiny image-forward cards show one discriminating tag while a filter drawer carries the full taxonomy.' },
  { id:'15', slug:'command-table', file:'option-15-command-table.html', family:'Scale + granular tags', name:'Command table', layout:'commandTable', note:'Fastest power-user flow',
    summary:'Search accepts removable tag tokens and drives a virtualized, keyboard-friendly deal table.' },
  { id:'16', slug:'world-table', file:'option-16-world-table.html', family:'Scale + granular tags', name:'World table', layout:'worldTable', note:'Bonus comparison',
    summary:'A facet-aware matrix compares only matched products while keeping the selected market visually primary.' },
  { id:'17', slug:'tag-shelves-current', file:'option-17-tag-shelves-current.html', family:'Option 12 refinement', name:'Uniqlo Tracker', layout:'tagShelvesCurrent', note:'Current branding',
    summary:'Tag Shelves refined with the current app wordmark, palette, and compact retail character.' },
  { id:'18', slug:'price-fold', file:'option-18-price-fold.html', family:'Option 12 refinement', name:'Price Fold', layout:'tagShelvesStudio', note:'Independent branding',
    summary:'The same high-volume layout recast as a distinctive apparel price-intelligence brand.' },
]

const current = concepts.find(c => c.slug === document.body.dataset.concept) || concepts[0]
const state = { market: localStorage.getItem('upt-design-market') || 'CA', query:'', dept:'All', tag:'All', selected:0, compare:false }

const colours = ['Navy','Black','Natural','Olive','Blue','Brown']
const volumeProducts = Array.from({ length:48 }, (_, instance) => {
  const source = products[instance % products.length]
  return { ...source, baseIndex:instance % products.length, instance, colour:colours[Math.floor(instance / products.length) % colours.length] }
})

function price(value, code = state.market) {
  const m = markets[code]
  return new Intl.NumberFormat(m.locale, { style:'currency', currency:m.currency, maximumFractionDigits:m.currency === 'JPY' ? 0 : 2 }).format(value)
}

const icon = name => ({
  search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
  arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5"/></svg>',
  grid:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></svg>',
  list:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".8"/><circle cx="4" cy="12" r=".8"/><circle cx="4" cy="18" r=".8"/></svg>',
  close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
})[name]

function wordmark() {
  if (current.layout === 'tagShelvesCurrent') {
    return '<span class="current-wordmark">UNIQLO<small>PRICE TRACKER</small></span>'
  }
  if (current.layout === 'tagShelvesStudio') {
    return '<span class="fold-mark" aria-hidden="true"><i></i></span><span class="fold-wordmark"><b>PRICE FOLD</b><small>Apparel price index</small></span>'
  }
  const retail = current.family.startsWith('Retail')
  return retail
    ? '<span class="retail-mark">UNI<br>QLO</span><span class="brand-copy"><b>Price Tracker</b><small>Independent tracker</small></span>'
    : `<span class="independent-mark">${current.id}</span><span class="brand-copy"><b>${current.name}</b><small>Price intelligence</small></span>`
}

function marketControl() {
  const m = markets[state.market]
  const usesFlag = current.layout === 'tagShelvesCurrent' || current.layout === 'tagShelvesStudio'
  return `<div class="market-control-wrap"><button class="market-control" data-market-toggle aria-expanded="false"><span class="${usesFlag ? 'market-flag' : 'market-stamp'}">${usesFlag ? m.flag : m.code}</span><span><b>${m.name}</b><small>${m.currency} · ${m.tax}</small></span><i>⌄</i></button>
    <div class="market-menu" data-market-menu hidden>${Object.values(markets).map(item => `<button data-market="${item.id}" class="${item.id === state.market ? 'active':''}"><span class="flag">${item.flag}</span><span><b>${item.name}</b><small>${item.currency} · ${item.tax}</small></span><i>${item.id === state.market ? '✓':''}</i></button>`).join('')}</div></div>`
}

function optionDock() {
  const index = concepts.indexOf(current)
  const prev = concepts[(index + concepts.length - 1) % concepts.length]
  const next = concepts[(index + 1) % concepts.length]
  return `<nav class="option-dock" aria-label="Design options"><a href="${prev.file}" aria-label="Previous design">←</a><a class="dock-index" href="index.html">${current.id}<span>/${concepts.length}</span></a><a href="${next.file}" aria-label="Next design">→</a></nav>`
}

function header() {
  return `<header class="site-header"><a class="brand" href="index.html">${wordmark()}</a><nav class="main-nav" aria-label="Main navigation"><a class="active" href="#deals">Deals</a><a href="#products">Products</a><a href="#about">FAQ</a></nav>${marketControl()}</header>`
}

function garment(p, large = false) {
  return `<span class="product-art ${large ? 'large':''}" style="--swatch:${p.swatch}"><i></i><em>${p.id}</em></span>`
}

function productRow(p, index) {
  const [now, regular, lowest] = p.prices[state.market]
  return `<button class="product-row" data-product="${index}">${garment(p)}<span class="product-copy"><b>${p.name}</b><small>${p.dept} · ${p.cat}</small>${p.low ? '<mark>Lowest</mark>' : `<small>Low ${price(lowest)}</small>`}</span><span class="price-copy"><b>${price(now)}</b><del>${price(regular)}</del><small>−${p.drop}%</small></span>${icon('arrow')}</button>`
}

function productCard(p, index, className = '') {
  const [now, regular] = p.prices[state.market]
  return `<button class="product-card ${className}" data-product="${index}">${garment(p, true)}<span class="card-copy"><small>${p.dept} · ${p.cat}</small><b>${p.name}</b><span class="card-price"><strong>${price(now)}</strong><del>${price(regular)}</del><i>−${p.drop}%</i></span>${p.low ? '<mark>Lowest</mark>' : ''}</span></button>`
}

function filters(compact = false) {
  return `<div class="filters ${compact ? 'compact':''}"><label class="search">${icon('search')}<input data-search type="search" placeholder="Search products or style code" aria-label="Search products"></label><div class="chips" role="group" aria-label="Department">${['All','Women','Men','Unisex'].map(x => `<button data-dept="${x}" class="${state.dept===x?'active':''}">${x}</button>`).join('')}</div></div>`
}

function marketLine() {
  const m = markets[state.market]
  return `<div class="market-line"><span class="market-stamp">${m.code}</span><b>${m.name}</b><span>${m.currency}</span><span>${m.checked}</span></div>`
}

function browseHeading(title = 'Today\'s best deals', kicker = '') {
  return `<section class="browse-heading" id="deals">${kicker ? `<p class="kicker">${kicker}</p>`:''}<h1>${title}</h1>${marketLine()}</section>`
}

function ledger() {
  return `<main class="page ledger-page">${browseHeading('Today\'s best deals')}${filters()}<div class="result-bar"><b><span data-count>${products.length}</span> deals</b><span>Biggest discount ↓</span></div><div class="product-list" data-products>${products.map(productRow).join('')}</div></main>`
}

function campaign() {
  return `<main class="page campaign-page">${browseHeading('Prices dropped.', 'Selected for today')}${filters(true)}<div class="campaign-grid" data-products>${products.map((p,i) => productCard(p,i,i===0?'feature':'')).join('')}</div></main>`
}

function catalogue() {
  return `<main class="catalogue-page"><aside class="catalogue-side"><span class="side-title">Browse</span>${['All deals','New lows','Women','Men','Kids','Outerwear','Tops','Bottoms'].map((x,i)=>`<button class="${i===0?'active':''}">${x}<i>${[126,18,42,51,16,27,48,31][i]}</i></button>`).join('')}</aside><section class="catalogue-main">${browseHeading('Deal catalogue')}${filters(true)}<div class="catalogue-head"><span>Product</span><span>Price</span><span>Drop</span></div><div class="product-list dense" data-products>${products.map(productRow).join('')}</div></section></main>`
}

function redline() {
  return `<main class="page redline-page">${browseHeading('The deal line.', `${markets[state.market].name} · ${products.length} moves`)}${filters(true)}<div class="redline-list" data-products>${products.map((p,i)=>{const [now,reg]=p.prices[state.market];return `<button class="redline-row" data-product="${i}"><span class="drop-number">−${p.drop}<sup>%</sup></span>${garment(p)}<span class="product-copy"><b>${p.name}</b><small>${p.dept} · ${p.cat}</small></span><span class="price-copy"><b>${price(now)}</b><del>${price(reg)}</del></span>${icon('arrow')}</button>`}).join('')}</div></main>`
}

function miniHistory(p) {
  return `<svg class="history" viewBox="0 0 520 150" role="img" aria-label="Price history"><path class="gridline" d="M0 30H520M0 75H520M0 120H520"/><path class="area" d="M0 35 L75 35 L75 54 L165 54 L165 42 L250 42 L250 84 L335 84 L335 72 L420 72 L420 118 L520 118 L520 150 L0 150Z"/><path class="plot" d="M0 35 L75 35 L75 54 L165 54 L165 42 L250 42 L250 84 L335 84 L335 72 L420 72 L420 118 L520 118"/><circle cx="520" cy="118" r="5"/></svg>`
}

function focusPanel(p = products[state.selected]) {
  const [now,regular,lowest] = p.prices[state.market]
  return `<section class="focus-panel" data-focus>${garment(p,true)}<div class="focus-title"><small>${p.dept} · ${p.cat} · ${p.id}</small><h2>${p.name}</h2></div><div class="focus-prices"><span><small>Now</small><b>${price(now)}</b></span><span><small>Typical</small><del>${price(regular)}</del></span><span><small>Low</small><b>${price(lowest)}</b></span></div>${miniHistory(p)}<div class="focus-actions"><button class="primary">Check sizes ↗</button><button class="save" aria-label="Save product">♡</button></div></section>`
}

function split() {
  return `<main class="split-page"><section class="split-browser">${browseHeading('Find a deal')}${filters()}<div class="product-list compact-list" data-products>${products.slice(0,6).map(productRow).join('')}</div></section>${focusPanel()}</main>`
}

function lens() {
  return `<main class="page lens-page">${browseHeading('Worth buying today.', `${products.length} verified drops`)}<div class="lens-toolbar">${filters(true)}<span class="trust-dot">Checked today</span></div><div class="lens-grid" data-products>${products.map((p,i)=>productCard(p,i,i===0?'feature':'')).join('')}</div></main>`
}

function board() {
  return `<main class="board-page">${browseHeading(`Drops / ${markets[state.market].code}`, 'Live price board')}<div class="board-tools">${filters(true)}<span>Updated ${markets[state.market].checked}</span></div><div class="board-table"><div class="board-head"><span>Item</span><span>Was</span><span>Now</span><span>Move</span></div><div data-products>${products.map((p,i)=>{const [now,regular]=p.prices[state.market];return `<button class="board-row" data-product="${i}"><span><i>${String(i+1).padStart(2,'0')}</i><b>${p.name}</b><small>${p.dept} / ${p.cat}</small></span><del>${price(regular)}</del><strong>${price(now)}</strong><em>↓ ${p.drop}%</em></button>`}).join('')}</div></div></main>`
}

function cards() {
  return `<main class="page field-page">${browseHeading('Good prices, clearly.', `${markets[state.market].flag} ${markets[state.market].name}`)}${filters(true)}<div class="field-grid" data-products>${products.map((p,i)=>productCard(p,i,i<2?'wide':'')).join('')}</div></main>`
}

function quietIndex() {
  return `<main class="page quiet-page"><div class="quiet-hero">${browseHeading('The price index.')}${filters(true)}</div><div class="quiet-key"><span>Item</span><span>Now</span><span>Change</span></div><div class="quiet-list" data-products>${products.map((p,i)=>{const [now]=p.prices[state.market];return `<button class="quiet-row" data-product="${i}"><span class="quiet-id">${p.id}</span><span class="quiet-name">${p.name}<small>${p.dept} · ${p.cat}</small></span><strong>${price(now)}</strong><em>−${p.drop}%</em></button>`}).join('')}</div></main>`
}

function compareTable() {
  if (!state.compare) return `<div class="atlas-local" data-products>${products.map(productRow).join('')}</div>`
  return `<p class="compare-note">Matched by style code · lowest after FX; tax varies</p><div class="compare-table" data-products><div class="compare-head"><span>Matched item</span>${Object.entries(markets).map(([id,m])=>`<span class="${id===state.market?'active':''}">${m.code}<small>${m.currency}</small></span>`).join('')}</div>${products.slice(0,6).map((p,i)=>{const values=Object.keys(markets).map(code=>({code,raw:p.prices[code][0]}));const best=values.reduce((a,b)=>convert(a.raw,a.code)<convert(b.raw,b.code)?a:b).code;return `<button class="compare-row" data-product="${i}"><span>${garment(p)}<b>${p.name}</b><small>${p.id}</small></span>${values.map(v=>`<span class="${v.code===best?'best':''}"><b>${price(v.raw,v.code)}</b>${v.code===best?'<small>Lowest after FX</small>':''}</span>`).join('')}</button>`}).join('')}</div>`
}

function convert(value, code) { return value * {CA:1,US:1.35,GB:1.83,JP:.0093}[code] }

function compare() {
  return `<main class="page atlas-page">${browseHeading('Browse locally. Compare when useful.', 'Market-aware price tracking')}<div class="atlas-toolbar">${filters(true)}<div class="view-switch" role="group" aria-label="Price view"><button data-view="local" class="${state.compare?'':'active'}">${markets[state.market].code} deals</button><button data-view="compare" class="${state.compare?'active':''}">Compare</button></div></div><div data-atlas>${compareTable()}</div></main>`
}

const facetGroups = [
  { label:'Category', items:[['Outerwear',54],['Bottoms',47],['Tops',43],['Accessories',31],['Innerwear',28]] },
  { label:'Material', items:[['AIRism',22],['Denim',18],['Merino wool',14],['Cotton',61],['PUFFTECH',12]] },
  { label:'Feature', items:[['Water-repellent',36],['Wide fit',27],['Quick dry',24],['Packable',19],['Warm',17]] },
]
const facetCounts = Object.fromEntries(facetGroups.flatMap(group => group.items))

function facetButton(item, count = '') {
  return `<button data-tag="${item}" class="${state.tag===item?'active':''}"><span>${item}</span>${count!==''?`<i>${count}</i>`:''}</button>`
}

function facetPanel() {
  return `<aside class="facet-panel"><div class="facet-panel-head"><b>Filter</b><button data-clear-tags>Clear</button></div>${facetGroups.map(group=>`<details open><summary>${group.label}<i>+</i></summary><div>${group.items.map(([tag,count])=>facetButton(tag,count)).join('')}</div></details>`).join('')}</aside>`
}

function tagRail() {
  return `<div class="tag-rail">${facetGroups.map(group=>`<div><span>${group.label}</span><div>${group.items.map(([tag,count])=>facetButton(tag,count)).join('')}</div></div>`).join('')}</div>`
}

function pathLabel(p) { return `${p.dept} / ${p.path.join(' / ')}` }

function tagBits(p, limit = 2) { return `<span class="tag-bits">${p.tags.slice(0,limit).map(tag=>`<i>${tag}</i>`).join('')}</span>` }

function volumeRow(p) {
  const [now,regular] = p.prices[state.market]
  return `<button class="volume-row" data-product="${p.baseIndex}" data-instance="${p.instance}">${garment(p)}<span class="volume-copy"><b>${p.name}</b><small>${pathLabel(p)} · ${p.colour}</small>${tagBits(p)}</span><span class="price-copy"><b>${price(now)}</b><del>${price(regular)}</del><small>−${p.drop}%</small></span></button>`
}

function volumeCard(p) {
  const [now,regular] = p.prices[state.market]
  return `<button class="volume-card" data-product="${p.baseIndex}" data-instance="${p.instance}">${garment(p,true)}<span><small>${p.path[1]} · ${p.colour}</small><b>${p.name}</b>${tagBits(p,1)}<em><strong>${price(now)}</strong><del>${price(regular)}</del><i>−${p.drop}%</i></em></span></button>`
}

function volumeHeading(title, kicker) {
  return `<div class="volume-heading"><div>${kicker?`<p class="kicker">${kicker}</p>`:''}<h1>${title}</h1></div><div class="volume-count"><strong data-volume-count>242</strong><span>deals</span></div></div>`
}

function facetRail() {
  return `<main class="volume-shell facet-rail-page">${facetPanel()}<section class="volume-main">${volumeHeading('All deals. No dead ends.', `${markets[state.market].code} catalogue`)}${filters(true)}<div class="volume-bar"><span><b data-volume-count>242</b> results</span><span>Discount ↓</span><span>Comfortable density</span></div><div class="volume-list columns" data-products>${volumeProducts.map(volumeRow).join('')}</div></section></main>`
}

function tagShelves() {
  return `<main class="page tag-shelves-page">${volumeHeading('242 deals, within reach.', `${markets[state.market].name} / browse by tag`)}${filters(true)}${tagRail()}<div class="mosaic-bar"><span><b data-volume-count>242</b> deals</span><button>Sort: biggest drop</button><button>Density: compact</button></div><div class="volume-mosaic" data-products>${volumeProducts.map(volumeCard).join('')}</div></main>`
}

function refinedTagShelves() {
  return `<main class="page tag-shelves-page refined-tag-page">${volumeHeading('Deals, within reach.', '')}${filters(true)}${tagRail()}<div class="mosaic-bar"><span><b data-volume-count>242</b> deals</span><button>Biggest drop ↓</button><button>Compact</button></div><div class="volume-mosaic" data-products>${volumeProducts.map(volumeCard).join('')}</div></main>`
}

function groupedLedger() {
  const groups = [
    ['Lightweight jackets',products[0],32],['Jeans',products[1],28],['T-shirts',products[3],46],['Sweaters',products[2],21],['Bags',products[5],19],['Trousers',products[6],34]
  ]
  return `<main class="page grouped-page">${volumeHeading('Deals by category.', `${markets[state.market].code} / 242 deals`)}${filters(true)}<nav class="group-jumps" aria-label="Jump to category">${groups.map(([name,,count])=>`<a href="#${name.toLowerCase().replaceAll(' ','-')}">${name}<i>${count}</i></a>`).join('')}</nav><div class="grouped-results" data-products>${groups.map(([name,p,count],groupIndex)=>`<section class="deal-group" id="${name.toLowerCase().replaceAll(' ','-')}"><header><span>${name}</span><b>${count}</b></header><div>${Array.from({length:6},(_,i)=>volumeRow({...p,baseIndex:products.indexOf(p),instance:groupIndex*6+i,colour:colours[i]})).join('')}</div></section>`).join('')}</div></main>`
}

function compactMosaic() {
  return `<main class="page compact-mosaic-page">${volumeHeading('The compact edit.', `${markets[state.market].code} / all 242 deals`)}<div class="compact-controls">${filters(true)}<button class="filter-drawer-trigger">Tags <i>3</i></button></div><div class="active-tag-line"><span>All categories</span><button data-tag="Water-repellent">Water-repellent</button><button data-tag="Wide fit">Wide fit</button><button data-tag="AIRism">AIRism</button></div><div class="micro-grid" data-products>${volumeProducts.map(volumeCard).join('')}</div></main>`
}

function commandTable() {
  return `<main class="page command-page">${volumeHeading('Find any deal.', `${markets[state.market].code} / command table`)}<div class="command-search"><span class="command-key">⌘K</span>${icon('search')}<input data-search type="search" placeholder="Search name, style code, or tag" aria-label="Search name, style code, or tag"><span class="query-token">On sale <button aria-label="Remove on sale filter">×</button></span></div><div class="command-tags"><span>Quick tags</span>${['AIRism','Wide fit','Water-repellent','Merino wool','Lowest'].map(tag=>facetButton(tag)).join('')}</div><div class="command-meta"><span><b data-volume-count>242</b> deals</span><span>All loaded · virtual rows</span><span>Discount ↓</span></div><div class="command-table"><div class="command-head"><span>Product</span><span>Tags</span><span>Now</span><span>Drop</span></div><div class="command-scroll" data-products>${volumeProducts.map(p=>{const [now]=p.prices[state.market];return `<button class="command-row" data-product="${p.baseIndex}" data-instance="${p.instance}"><span>${garment(p)}<span><b>${p.name}</b><small>${p.id} · ${p.colour}</small></span></span>${tagBits(p)}<strong>${price(now)}</strong><em>−${p.drop}%</em></button>`}).join('')}</div></div></main>`
}

function worldTable() {
  const rows = volumeProducts.slice(0,24)
  return `<main class="world-page"><aside class="world-facets">${facetPanel()}</aside><section class="world-main">${volumeHeading('Compare a filtered set.', 'Bonus / matched markets')}<div class="world-top">${filters(true)}<div class="match-stat"><b>178</b><span>matched / 242</span></div></div><p class="compare-note">Same style code · local currency · lowest after FX; tax varies <span class="mobile-swipe">Swipe markets →</span></p><div class="world-table"><div class="world-head"><span>Product + tags</span>${Object.entries(markets).map(([id,m])=>`<span class="${id===state.market?'active':''}">${m.code}<small>${m.currency}</small></span>`).join('')}</div><div class="world-scroll" data-products>${rows.map(p=>{const values=Object.keys(markets).map(code=>({code,raw:p.prices[code][0]}));const best=values.reduce((a,b)=>convert(a.raw,a.code)<convert(b.raw,b.code)?a:b).code;return `<button class="world-row" data-product="${p.baseIndex}" data-instance="${p.instance}"><span>${garment(p)}<span><b>${p.name}</b><small>${p.path[1]} · ${p.tags[0]} · ${p.colour}</small></span></span>${values.map(v=>`<span class="${v.code===state.market?'selected':''} ${v.code===best?'best':''}"><b>${price(v.raw,v.code)}</b>${v.code===best?'<small>Lowest FX</small>':''}</span>`).join('')}</button>`}).join('')}</div></div></section></main>`
}

function detailDialog(p) {
  const [now,regular,lowest]=p.prices[state.market]
  return `<dialog class="detail-dialog"><div class="dialog-head"><span>Price history</span><button data-close aria-label="Close">${icon('close')}</button></div><div class="dialog-body"><div class="dialog-product">${garment(p,true)}<div><small>${p.dept} · ${p.cat} · ${p.id}</small><h2>${p.name}</h2></div></div><div class="dialog-prices"><span><small>Current</small><b>${price(now)}</b></span><span><small>Typical</small><del>${price(regular)}</del></span><span><small>Recorded low</small><b>${price(lowest)}</b></span></div>${miniHistory(p)}<button class="primary store-button">Check sizes on Uniqlo ↗</button></div></dialog>`
}

const renderers = { ledger, campaign, catalogue, redline, split, lens, board, cards, index:quietIndex, compare, facetRail, tagShelves, tagShelvesCurrent:refinedTagShelves, tagShelvesStudio:refinedTagShelves, groupedLedger, compactMosaic, commandTable, worldTable }

function render() {
  document.title = `${current.id} · ${current.name} — Market design system`
  document.documentElement.style.setProperty('--concept', current.id)
  document.querySelector('#app').innerHTML = `${header()}${renderers[current.layout]()}${optionDock()}<div data-dialog-host></div>`
  const search = document.querySelector('[data-search]')
  if (search) search.value = state.query
  bind()
  filterProducts()
}

function bind() {
  const toggle = document.querySelector('[data-market-toggle]')
  const menu = document.querySelector('[data-market-menu]')
  toggle?.addEventListener('click', () => { const open=menu.hidden; menu.hidden=!open; toggle.setAttribute('aria-expanded',String(open)) })
  document.querySelectorAll('[data-market]').forEach(button => button.addEventListener('click',()=>{ state.market=button.dataset.market; localStorage.setItem('upt-design-market',state.market); render() }))
  document.querySelectorAll('[data-dept]').forEach(button => button.addEventListener('click',()=>{state.dept=button.dataset.dept; filterProducts()}))
  document.querySelectorAll('[data-tag]').forEach(button => button.addEventListener('click',()=>{state.tag=state.tag===button.dataset.tag?'All':button.dataset.tag; filterProducts()}))
  document.querySelectorAll('[data-clear-tags]').forEach(button => button.addEventListener('click',()=>{state.tag='All';state.dept='All';state.query='';const search=document.querySelector('[data-search]');if(search)search.value='';filterProducts()}))
  document.querySelector('[data-search]')?.addEventListener('input', event => { state.query=event.target.value; filterProducts() })
  document.querySelectorAll('[data-product]').forEach(button => button.addEventListener('click',()=>selectProduct(Number(button.dataset.product))))
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click',()=>{state.compare=button.dataset.view==='compare'; document.querySelector('[data-atlas]').innerHTML=compareTable(); bindProductButtons(); document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===button.dataset.view))}))
}

function bindProductButtons() { document.querySelectorAll('[data-product]').forEach(button => button.addEventListener('click',()=>selectProduct(Number(button.dataset.product)))) }

function selectProduct(index) {
  state.selected=index
  if (current.layout==='split') { document.querySelector('[data-focus]').outerHTML=focusPanel(products[index]); return }
  const host=document.querySelector('[data-dialog-host]'); host.innerHTML=detailDialog(products[index]); const dialog=host.querySelector('dialog'); dialog.showModal(); dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close()); dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()})
}

function filterProducts() {
  const query=state.query.toLowerCase().trim()
  document.querySelectorAll('[data-products] [data-product]').forEach(node=>{const p=products[Number(node.dataset.product)];const searchable=[p.name,p.id,p.cat,...p.path,...p.tags].join(' ').toLowerCase();const matchesTag=state.tag==='All'||p.cat===state.tag||p.path.includes(state.tag)||p.tags.includes(state.tag);node.hidden=!(state.dept==='All'||p.dept===state.dept)||!searchable.includes(query)||!matchesTag})
  document.querySelectorAll('[data-dept]').forEach(x=>x.classList.toggle('active',x.dataset.dept===state.dept))
  document.querySelectorAll('[data-tag]').forEach(x=>x.classList.toggle('active',x.dataset.tag===state.tag))
  const count=[...document.querySelectorAll('[data-products] [data-product]')].filter(x=>!x.hidden).length
  document.querySelector('[data-count]')?.replaceChildren(String(count))
  const visibleBase=products.filter(p=>(state.dept==='All'||p.dept===state.dept)&&(state.tag==='All'||p.cat===state.tag||p.path.includes(state.tag)||p.tags.includes(state.tag))&&[p.name,p.id,p.cat,...p.path,...p.tags].join(' ').toLowerCase().includes(query)).length
  const volumeCount = !query && state.dept === 'All' && state.tag !== 'All' && facetCounts[state.tag]
    ? facetCounts[state.tag] : Math.round(242*visibleBase/products.length)
  document.querySelectorAll('[data-volume-count]').forEach(node=>node.replaceChildren(String(volumeCount)))
}

render()

document.addEventListener('click', event => {
  const menu = document.querySelector('[data-market-menu]')
  if (!event.target.closest('.market-control-wrap') && menu) menu.hidden = true
})
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return
  const menu = document.querySelector('[data-market-menu]')
  if (menu) menu.hidden = true
  document.querySelector('.detail-dialog[open]')?.close()
})
