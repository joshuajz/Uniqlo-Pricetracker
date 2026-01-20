import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { HomePage } from '@/pages/HomePage'
import { ProductPage } from '@/pages/ProductPage'
import { SearchPage } from '@/pages/SearchPage'
import { getStats } from '@/lib/api'
import type { Stats } from '@/types'

function App() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    getStats().then(setStats).catch(console.error)
  }, [])

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/search" element={<SearchPage />} />
          </Routes>
        </main>
        <Footer lastScraped={stats?.lastScraped} />
      </div>
    </BrowserRouter>
  )
}

export default App
