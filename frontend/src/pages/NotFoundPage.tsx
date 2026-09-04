import { Link } from 'react-router-dom'
export default function NotFoundPage() {
  return <div className="page-container not-found"><h1 tabIndex={-1}>Page not found</h1><p>This link may be out of date. Find products using the links below.</p><div className="empty-actions"><Link className="primary-button" to="/">Browse deals</Link><Link className="secondary-button" to="/categories">All products</Link></div></div>
}
