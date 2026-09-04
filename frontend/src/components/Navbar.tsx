import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { track } from '../lib/analytics'
import { useTheme } from '../context/ThemeContext'

function rememberedSearch() { try { return sessionStorage.getItem('uniqlo-browse-search') ?? '' } catch { return '' } }

export default function Navbar() {
  const { theme, toggle } = useTheme()
  const location = useLocation()
  const [lastSearch, setLastSearch] = useState(rememberedSearch)
  const browsing = location.pathname === '/' || location.pathname === '/categories'
  const params = new URLSearchParams(browsing ? location.search : lastSearch)
  params.delete('modal')
  const search = params.toString()
  useEffect(() => {
    if (!browsing) return
    setLastSearch(search)
    try { sessionStorage.setItem('uniqlo-browse-search', search) } catch { /* Private browsing may disable storage. */ }
  }, [browsing, search])
  return <nav className="site-nav" aria-label="Main navigation">
    <NavLink to="/" className="brand" aria-label="Uniqlo Price Tracker home">UNIQLO<span>PRICE TRACKER</span></NavLink>
    <div className="nav-links">
      <NavLink to={{ pathname: '/', search }} end>Deals</NavLink>
      <NavLink to={{ pathname: '/categories', search }}>All products</NavLink>
      <NavLink to="/faq">FAQ</NavLink>
    </div>
    <span className="nav-region">Canada · CAD</span>
    <button type="button" className="icon-button theme-toggle" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => { track('theme_toggled', { new_theme: theme === 'dark' ? 'light' : 'dark' }); toggle() }}>
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  </nav>
}
