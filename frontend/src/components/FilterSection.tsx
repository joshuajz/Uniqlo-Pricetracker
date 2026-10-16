import { useId, useState, type ReactNode } from 'react'

export default function FilterSection({ title, selected = 0, collapsible = false, className = '', children }: {
  title: string
  selected?: number
  collapsible?: boolean
  className?: string
  children: ReactNode
}) {
  const id = useId()
  const [open, setOpen] = useState(true)
  const heading = <>{title}{selected > 0 && <span className="filter-selected-count">{selected} selected</span>}</>
  return <section className={`filter-group ${className}`} aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}>{collapsible ? <button type="button" className="filter-section-toggle"
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span>{heading}</span><span aria-hidden="true">{open ? '−' : '+'}</span>
    </button> : heading}</h3>
    <div id={id} hidden={collapsible && !open}>{children}</div>
  </section>
}
