import { Link } from 'react-router-dom'
import { PRIVACY_SETTINGS_EVENT } from '../lib/analytics'

export default function Footer() {
  return <footer className="site-footer">
    <span>Uniqlo Price Tracker · Canada · Updated daily.<br />Independent tracker. Not affiliated with Uniqlo Co., Ltd.</span>
    <nav className="legal-links" aria-label="Legal and privacy">
      <Link to="/terms">Terms</Link>
      <Link to="/privacy">Privacy</Link>
      <button type="button" onClick={() => window.dispatchEvent(new Event(PRIVACY_SETTINGS_EVENT))}>Privacy settings</button>
    </nav>
    <span>© {new Date().getFullYear()}</span>
  </footer>
}
