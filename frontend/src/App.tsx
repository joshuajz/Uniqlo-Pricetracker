import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { PostHogProvider } from '@posthog/react'
import posthog from 'posthog-js'
import { track } from './lib/analytics'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollManager from './components/ScrollManager'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import CategoriesPage from './pages/CategoriesPage'
import FAQPage from './pages/FAQPage'
import NotFoundPage from './pages/NotFoundPage'

function PageviewTracker() {
  const location = useLocation()
  useEffect(() => {
    track('$pageview')
    const title = location.pathname === '/' ? 'Deals' : location.pathname === '/categories' ? 'All products' : location.pathname === '/faq' ? 'FAQ' : 'Page not found'
    document.title = `${title} | Uniqlo Price Tracker Canada`
  }, [location])
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
        <Route path="/faq" element={<FAQPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes></main><Footer />
    </div>
  </BrowserRouter></PostHogProvider>
}
