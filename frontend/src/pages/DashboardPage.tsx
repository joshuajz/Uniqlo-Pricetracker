import { useMarket } from '../context/MarketContext'
import { marketPath } from '../lib/markets'
import { Navigate, useLocation } from 'react-router-dom'

// Keep old shared links working without maintaining a second deals interface.
export default function DashboardPage() {
  const market = useMarket()
  const { search } = useLocation()
  return <Navigate to={{ pathname: marketPath(market), search }} replace />
}
