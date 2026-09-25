import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { track } from '../lib/analytics'
import { useTheme } from '../context/ThemeContext'
import { useMarket } from '../context/MarketContext'
import { marketPath, splitMarketPath } from '../lib/markets'
import MarketSelector from './MarketSelector'

function rememberedSearch(key: string) { try { return sessionStorage.getItem(key) ?? '' } catch { return '' } }

export default function Navbar() {
  const market = useMarket()
  const storageKey = `uniqlo-browse-search:${market.code}`
  const { theme, toggle } = useTheme()
  const location = useLocation()
  const [lastSearch, setLastSearch] = useState(() => rememberedSearch(storageKey))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const browsing = ['/', '/categories'].includes(splitMarketPath(location.pathname).path)
  const params = new URLSearchParams(browsing ? location.search : lastSearch)
  params.delete('modal')
  const search = params.toString()
  useEffect(() => {
    if (!browsing) return
    setLastSearch(search)
    try { sessionStorage.setItem(storageKey, search) } catch { /* Private browsing may disable storage. */ }
  }, [browsing, search, storageKey])
  useEffect(() => {
    if (!mobileMenuOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setMobileMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMobileMenuOpen(false)
      mobileMenuButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [mobileMenuOpen])

  const closeMobileMenu = () => setMobileMenuOpen(false)
  return <nav className="site-nav" aria-label="Main navigation" ref={navRef}>
    <NavLink to={marketPath(market)} className="brand" aria-label="Uniqlo Price Tracker home">UNIQLO<span>PRICE TRACKER</span></NavLink>
    <div className="nav-links">
      <NavLink to={{ pathname: marketPath(market), search }} end>Deals</NavLink>
      <NavLink to={{ pathname: marketPath(market, '/categories'), search }}>All products</NavLink>
      <NavLink to={marketPath(market, '/faq')}>FAQ</NavLink>
    </div>
    <MarketSelector />
    <button type="button" className="icon-button theme-toggle" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => { track('theme_toggled', { new_theme: theme === 'dark' ? 'light' : 'dark' }); toggle() }}>
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
    <button ref={mobileMenuButtonRef} type="button" className="icon-button mobile-nav-toggle"
      aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen}
      aria-controls="mobile-navigation" onClick={() => setMobileMenuOpen(open => !open)}>
      {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
    </button>
    {mobileMenuOpen && <div className="mobile-nav-panel" id="mobile-navigation">
      <NavLink to={{ pathname: marketPath(market), search }} end onClick={closeMobileMenu}>Deals</NavLink>
      <NavLink to={{ pathname: marketPath(market, '/categories'), search }} onClick={closeMobileMenu}>All products</NavLink>
      <NavLink to={marketPath(market, '/faq')} onClick={closeMobileMenu}>FAQ</NavLink>
      <span className="mobile-nav-context">Independent tracker · Prices checked daily</span>
    </div>}
  </nav>
}
