import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export default function SortControl({ label, value, onChange, children }: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return <label className="sort-label"><span className="sort-caption">Sort by</span>
    <span className="sort-control">
      <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>{children}</select>
      <ChevronDown size={16} aria-hidden="true" />
    </span>
  </label>
}
