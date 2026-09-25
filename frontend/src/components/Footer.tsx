import { useMarket } from '../context/MarketContext'
import { marketPath } from '../lib/markets'
import { Link } from 'react-router-dom'
import { PRIVACY_SETTINGS_EVENT } from '../lib/analytics'

export default function Footer() {
  const market = useMarket()
  return <footer className="site-footer">
    <span>Uniqlo Price Tracker · {market.name} · Updated daily.<br />Independent tracker. Not affiliated with Uniqlo Co., Ltd.</span>
    <nav className="legal-links" aria-label="Legal and privacy">
      <Link to={marketPath(market, '/terms')}>Terms</Link>
      <Link to={marketPath(market, '/privacy')}>Privacy</Link>
      <button type="button" onClick={() => window.dispatchEvent(new Event(PRIVACY_SETTINGS_EVENT))}>Privacy settings</button>
    </nav>
    <span>© {new Date().getFullYear()}</span>
  </footer>
}
