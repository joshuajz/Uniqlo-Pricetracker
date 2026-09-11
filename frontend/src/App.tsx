import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { PostHogProvider } from '@posthog/react'
import posthog from 'posthog-js'
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
  return <PostHogProvider client={posthog}><BrowserRouter>
    <ScrollManager /><PageviewTracker />
    <div className="app-shell"><a className="skip-link" href="#main-content">Skip to products and content</a><Navbar />
      <main id="main-content" tabIndex={-1}><Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/products/:productId" element={<ProductPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes></main><Footer />
    </div>
  </BrowserRouter></PostHogProvider>
}
