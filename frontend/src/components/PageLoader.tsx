import { useEffect, useState } from 'react'
export default function PageLoader() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 6000)
    return () => window.clearTimeout(timer)
  }, [])
  return <div className="page-loader" role="status">
    <p>{slow ? 'Prices are taking longer than usual to load. Please wait…' : 'Loading the latest recorded prices…'}</p>
    <div aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton-row"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>)}</div>
  </div>
}
