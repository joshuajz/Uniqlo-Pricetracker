import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
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
  const previousPath = useRef(location.pathname)
  useEffect(() => {
    track('$pageview')
    if (!location.pathname.startsWith('/products/')) applyMetadata(pageMetadata(location.pathname))
  }, [location])
  useEffect(() => {
    if (previousPath.current === location.pathname) return
    previousPath.current = location.pathname
    document.querySelector<HTMLElement>('#main-content h1')?.focus({ preventScroll: true })
  }, [location.pathname])
  return null
}

export default function App() {
  return <BrowserRouter>
    <ScrollManager /><PageviewTracker />
    <div className="app-shell"><a className="skip-link" href="#main-content">Skip to products and content</a><Navbar />
      <main id="main-content" tabIndex={-1}><Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/products/:productId" element={<ProductPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/terms" element={<LegalPage document="terms" />} />
        <Route path="/privacy" element={<LegalPage document="privacy" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes></main><Footer /><PrivacyConsent />
    </div>
  </BrowserRouter>
}
