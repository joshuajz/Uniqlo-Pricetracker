import { useMarket } from '../context/MarketContext'
import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { HISTORY_RANGES, historySummary, historyWindow, priceAxis, type HistoryRange } from '../lib/history'
import type { ProductDatapoint } from '../types/types'
import { chartHistory, DAY, formatRecordingDate, money, recordedHistory } from '../lib/products'

type Observation = { time: number; price: number }
type CalendarDay = { day: number; inRange: boolean; observation?: Observation }
type CalendarMonth = { key: string; label: string; offset: number; days: CalendarDay[] }

function priceCalendar(observations: Observation[]): CalendarMonth[] {
  if (!observations.length) return []
  const byDate = new Map(observations.map(point => [new Date(point.time).toISOString().slice(0, 10), point]))
  const first = new Date(observations[0].time)
  const last = new Date(observations[observations.length - 1].time)
  const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1))
  const finalMonth = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1)
  const months: CalendarMonth[] = []

  while (cursor.getTime() <= finalMonth) {
    const year = cursor.getUTCFullYear()
    const month = cursor.getUTCMonth()
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      const time = Date.UTC(year, month, day)
      const key = new Date(time).toISOString().slice(0, 10)
      return { day, inRange: time >= observations[0].time && time <= observations[observations.length - 1].time, observation: byDate.get(key) }
    })
    months.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(cursor),
      offset: cursor.getUTCDay(),
      days,
    })
    cursor.setUTCMonth(month + 1)
  }
  return months.reverse()
}

export default function PriceHistory({ datapoints, typicalPrice }: { datapoints: ProductDatapoint[]; typicalPrice: number }) {
  const market = useMarket()
  const formatMoney = (value: number) => money(value, market)
  const [range, setRange] = useState<HistoryRange>('all')
  const selected = useMemo(() => historyWindow(datapoints, range), [datapoints, range])
  const observations = useMemo(() => recordedHistory(selected), [selected])
  const series = useMemo(() => chartHistory(selected), [selected])
  const summary = useMemo(() => historySummary(selected), [selected])
  const overall = useMemo(() => historySummary(datapoints), [datapoints])
  const calendarMonths = useMemo(() => priceCalendar(observations), [observations])
  if (!observations.length) return <p className="notice">No price observations are available yet.</p>
  const first = observations[0]
  const last = observations[observations.length - 1]
  const dateLabel = (time: number, year = false) => formatRecordingDate(new Date(time).toISOString(), year)
  const min = Math.min(typicalPrice, ...observations.map(d => d.price))
  const max = Math.max(typicalPrice, ...observations.map(d => d.price))
  const axis = priceAxis(min, max, market.currency === 'JPY' ? 1 : .01)
  const axisMoney = new Intl.NumberFormat(market.locale, { style: 'currency', currency: market.currency, minimumFractionDigits: 0 })
  const ticks = [...new Set([first.time, Math.floor((first.time + last.time) / 2 / DAY) * DAY, last.time])]
  const hasGaps = series.some(d => d.price === null)
  const priceLevel = (price: number) => {
    if (max === min) return 'single'
    const position = (price - min) / (max - min)
    return position <= .2 ? 'lowest' : position <= .5 ? 'low' : position <= .8 ? 'mid' : 'high'
  }

  return (
    <section className="price-history" aria-labelledby="history-heading">
      <div className="chart-heading"><h3 id="history-heading">Price history</h3>
        <span>{dateLabel(first.time, true)} – {dateLabel(last.time, true)}</span>
      </div>
      <div className="history-range-controls" role="group" aria-label="Price history range">
        {HISTORY_RANGES.map(option => <button key={option.value} type="button" aria-pressed={range === option.value}
          onClick={() => setRange(option.value)}>{option.label}</button>)}
      </div>
      <p className="history-range-note">Ranges end at the last recorded price. Typical price uses the full history.</p>
      {summary && overall && <dl className="history-summary" aria-live="polite">
        <div><dt>Lowest in this range</dt><dd>{formatMoney(summary.low.price)}<small>Last recorded {dateLabel(summary.low.time, true)}</small></dd></div>
        <div><dt>Highest in this range</dt><dd>{formatMoney(summary.high.price)}<small>Last recorded {dateLabel(summary.high.time, true)}</small></dd></div>
        <div><dt>Latest price streak</dt><dd>{overall.streak} {overall.streak === 1 ? 'day' : 'days'}<small>Consecutive recordings through {dateLabel(overall.last.time)}</small></dd></div>
      </dl>}
      {observations.length === 1 ? <p className="notice">One price recorded in this range: {dateLabel(first.time, true)} at {formatMoney(first.price)} {market.currency}. More daily observations are needed to show a trend.</p>
        : <>
          <div className="history-chart" role="img" aria-label={`Daily recorded prices in ${market.currency}. First ${formatMoney(first.price)} on ${dateLabel(first.time, true)}; latest ${formatMoney(last.price)} on ${dateLabel(last.time, true)}. A date and price table follows.`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 26, right: 26, left: 0, bottom: 6 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="time" type="number" scale="time" domain={[first.time, last.time]} ticks={ticks}
                  tickFormatter={time => dateLabel(Number(time))} tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  axisLine={false} tickLine={false} minTickGap={22} />
                <YAxis domain={axis.domain} ticks={axis.ticks} width={65}
                  tickFormatter={value => axisMoney.format(Number(value))} tick={{ fontSize: 12, fill: 'var(--muted)' }}
                  axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={value => dateLabel(Number(value), true)}
                  formatter={value => [formatMoney(Number(value)), 'Recorded price']}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 0, color: 'var(--ink)', fontSize: 12 }}
                  labelStyle={{ color: 'var(--muted)' }} itemStyle={{ color: 'var(--ink)' }}
                  cursor={{ stroke: 'var(--muted)' }} />
                <ReferenceLine y={typicalPrice} stroke="var(--muted)" strokeDasharray="3 4" />
                <Area type="stepAfter" dataKey="price" stroke="var(--ink)" strokeWidth={2}
                  fill="var(--ink)" fillOpacity={0.045} dot={false} activeDot={{ r: 4 }}
                  connectNulls={false} isAnimationActive={false} />
                <ReferenceDot x={last.time} y={last.price} r={3.5} fill="var(--accent)" stroke="var(--surface)"
                  label={{ value: formatMoney(last.price), position: 'left', offset: 10, fill: 'var(--ink)', fontSize: 12, dy: -12 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-caption">Steps connect daily observations; changes between checks are unknown. Dashed line: typical tracked price ({formatMoney(typicalPrice)}).{hasGaps && ' Gaps indicate days without a recorded price.'}</p>
        </>}
      <details className="history-calendar">
        <summary>View {observations.length} recorded {observations.length === 1 ? 'price' : 'prices'} in this range</summary>
        <div className="price-calendar-months" aria-hidden="true">
          {calendarMonths.map(month => <section className="price-calendar-month" aria-label={month.label} key={month.key}>
            <h4>{month.label}</h4>
            <div className="price-calendar-weekdays" aria-hidden="true"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>
            <div className="price-calendar-grid">
              {Array.from({ length: month.offset }, (_, index) => <span className="price-calendar-day is-empty" aria-hidden="true" key={`empty-${index}`} />)}
              {month.days.map(({ day, inRange, observation }) => !inRange
                ? <span className="price-calendar-day is-empty" aria-hidden="true" key={day} />
                : observation ? <time className="price-calendar-day has-price" data-level={priceLevel(observation.price)}
                    dateTime={new Date(observation.time).toISOString().slice(0, 10)}
                    title={`${dateLabel(observation.time, true)}: ${formatMoney(observation.price)}`}
                    aria-label={`${dateLabel(observation.time, true)}: ${formatMoney(observation.price)}`} key={day}>
                    <span>{day}</span><strong>{formatMoney(observation.price)}</strong>
                  </time>
                : <span className="price-calendar-day is-missing" aria-label={`${month.label} ${day}: no recorded price`} key={day}><span>{day}</span></span>)}
            </div>
          </section>)}
        </div>
        <table className="sr-only">
          <caption>Daily recorded prices, most recent first</caption>
          <thead><tr><th scope="col">Recording date</th><th scope="col">Price ({market.currency})</th></tr></thead>
          <tbody>{[...observations].reverse().map(point => <tr key={point.time}>
            <td>{dateLabel(point.time, true)}</td><td>{formatMoney(point.price)}</td>
          </tr>)}</tbody>
        </table>
      </details>
    </section>
  )
}
