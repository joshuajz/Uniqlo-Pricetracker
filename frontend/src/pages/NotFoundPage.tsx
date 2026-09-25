import { useMarket } from '../context/MarketContext'
import { marketPath } from '../lib/markets'
import { Link } from 'react-router-dom'
export default function NotFoundPage() {
  const market = useMarket()
  return <div className="page-container not-found"><h1 tabIndex={-1}>Page not found</h1><p>This link may be out of date. Find products using the links below.</p><div className="empty-actions"><Link className="primary-button" to={marketPath(market, '/')}>Browse deals</Link><Link className="secondary-button" to={marketPath(market, '/categories')}>All products</Link></div></div>
}
