const start = new Date('2026-06-05T12:00:00')
const end = new Date('2026-09-10T12:00:00')
const missing = new Set([5, 14, 23, 32, 41, 50, 59, 68, 77, 86, 95])
const prices = []

function priceFor(date) {
  const key = date.toISOString().slice(0, 10)
  if (key < '2026-07-08') return 39.90
  if (key < '2026-07-23') return 29.90
  if (key < '2026-08-08') return 19.90
  if (key < '2026-08-25') return 14.90
  return 9.90
}

for (let date = new Date(start), index = 0; date <= end; date.setDate(date.getDate() + 1), index += 1) {
  if (!missing.has(index)) prices.push({ date: new Date(date), price: priceFor(date) })
}

const money = value => `$${value.toFixed(2)}`
const fullDate = date => date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
const shortDate = date => date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
const monthName = date => date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
const level = price => price >= 39 ? 'high' : price >= 29 ? 'mid' : price >= 19 ? 'sale' : price >= 14 ? 'sale-low' : 'low'

const ledger = document.querySelector('[data-ledger]')
if (ledger) {
  const byMonth = new Map()
  prices.slice().reverse().forEach(point => {
    const key = monthName(point.date)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key).push(point)
  })
  ledger.innerHTML = [...byMonth].map(([month, points]) => `
    <section class="ledger-month">
      <h3>${month}<span>${points.length}</span></h3>
      <div class="ledger-rows">${points.map((point, index) => {
        const previous = points[index + 1]
        const changed = !previous || previous.price !== point.price
        return `<div class="ledger-row${changed ? ' changed' : ''}"><time datetime="${point.date.toISOString().slice(0, 10)}">${point.date.toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric' })}</time><strong>${money(point.price)}</strong></div>`
      }).join('')}</div>
    </section>`).join('')
}

const runs = document.querySelector('[data-runs]')
if (runs) {
  const groups = []
  prices.forEach(point => {
    const current = groups[groups.length - 1]
    if (!current || current.price !== point.price) groups.push({ price: point.price, points: [point] })
    else current.points.push(point)
  })
  runs.innerHTML = groups.slice().reverse().map((run, index) => {
    const first = run.points[0]
    const last = run.points[run.points.length - 1]
    return `<details class="price-run"${index === 0 ? ' open' : ''}>
      <summary>
        <span class="run-marker" data-level="${level(run.price)}"></span>
        <strong>${money(run.price)}</strong>
        <span>${shortDate(first.date)} – ${shortDate(last.date)}</span>
        <small>${run.points.length} checks</small>
      </summary>
      <div class="run-dates">${run.points.slice().reverse().map(point => `<time datetime="${point.date.toISOString().slice(0, 10)}">${fullDate(point.date)}</time>`).join('')}</div>
    </details>`
  }).join('')
}

const calendar = document.querySelector('[data-calendar]')
if (calendar) {
  const observed = new Map(prices.map(point => [point.date.toISOString().slice(0, 10), point]))
  const months = [[2026, 5], [2026, 6], [2026, 7], [2026, 8]]
  calendar.innerHTML = months.map(([year, month]) => {
    const monthDate = new Date(year, month, 1, 12)
    const days = new Date(year, month + 1, 0).getDate()
    const offset = monthDate.getDay()
    const cells = Array.from({ length: offset }, () => '<span class="calendar-day empty"></span>')
    for (let day = 1; day <= days; day += 1) {
      const date = new Date(year, month, day, 12)
      const key = date.toISOString().slice(0, 10)
      const point = observed.get(key)
      const outOfRange = date < start || date > end
      cells.push(point
        ? `<time class="calendar-day" data-level="${level(point.price)}" datetime="${key}" aria-label="${fullDate(date)}: ${money(point.price)}"><span>${day}</span><strong>${Math.round(point.price)}</strong></time>`
        : `<span class="calendar-day ${outOfRange ? 'empty' : 'missing'}"><span>${outOfRange ? '' : day}</span></span>`)
    }
    return `<section class="calendar-month"><h3>${monthName(monthDate)}</h3><div class="weekday"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div><div class="calendar-grid">${cells.join('')}</div></section>`
  }).join('')
}

document.querySelector('[data-close]')?.addEventListener('click', () => { window.location.href = 'index.html' })
