import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { MarketContext } from './context/MarketContext'
import { legacyDestination, marketPath, rememberedMarket, rememberMarket, splitMarketPath } from './lib/markets'
import { track } from './lib/analytics'
import { applyMetadata, pageMetadata } from './lib/metadata'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollManager from './components/ScrollManager'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import CategoriesPage from './pages/CategoriesPage'
import FAQPage from './pages/FAQPage'
import ProductPage from './pages/ProductPage'
import NotFoundPage from './pages/NotFoundPage'
import PrivacyConsent from './components/PrivacyConsent'
import LegalPage from './pages/LegalPage'

function PageviewTracker() {
  const location = useLocation()
  useEffect(() => {
    track('$pageview')
    if (!splitMarketPath(location.pathname).path.startsWith('/products/')) applyMetadata(pageMetadata(location.pathname))
  }, [location])
  return null
}

function RouteFocusManager() {
  const { pathname } = useLocation()
  const previousPath = useRef(pathname)
  useEffect(() => {
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    const heading = document.querySelector<HTMLElement>('#main-content h1')
    if (heading) heading.tabIndex = -1
    const target = heading ?? document.getElementById('main-content')
    target?.focus({ preventScroll: true })
  }, [pathname])
  return null
}

function LegacyRedirect() {
  const { pathname, search, hash } = useLocation()
  return <Navigate replace to={{ pathname: legacyDestination(pathname, rememberedMarket(), search), search, hash }} />
}

function MarketSite() {
  const { pathname, search, hash } = useLocation()
  const { market, path } = splitMarketPath(pathname)
  useEffect(() => { if (market) rememberMarket(market) }, [market])
  if (!market) return <NotFoundPage />
  const canonical = marketPath(market, path)
  if (pathname !== canonical) return <Navigate replace to={{ pathname: canonical, search, hash }} />
  return <MarketContext.Provider value={market} key={market.code}>
    <ScrollManager /><PageviewTracker />
    <div className="app-shell"><a className="skip-link" href="#main-content">Skip to products and content</a><Navbar />
      <main id="main-content" tabIndex={-1}><Routes>
        <Route index element={<HomePage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="products/:productId" element={<ProductPage />} />
        <Route path="faq" element={<FAQPage />} />
        <Route path="terms" element={<LegalPage document="terms" />} />
        <Route path="privacy" element={<LegalPage document="privacy" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes></main><Footer /><PrivacyConsent />
    </div>
  </MarketContext.Provider>
}

export default function App() {
  return <BrowserRouter><RouteFocusManager /><Routes>
    {['/', '/categories', '/dashboard', '/products/:productId', '/faq', '/terms', '/privacy'].map(path =>
      <Route key={path} path={path} element={<LegacyRedirect />} />)}
    <Route path="/:market/*" element={<MarketSite />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes></BrowserRouter>
}
