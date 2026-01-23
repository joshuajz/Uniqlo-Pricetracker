import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, TrendingDown, Package, Percent, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard'
import { getProducts } from '@/lib/api'
import type { Product } from '@/types'

const sortOptions = [
  { value: 'recent', label: 'Recently Updated' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'discount', label: 'Biggest Discount' },
]

const ITEMS_PER_PAGE = 12

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sort, setSort] = useState(searchParams.get('sort') || 'recent')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(() => {
    const page = searchParams.get('page')
    return page ? parseInt(page, 10) : 1
  })
  const isFirstRender = useRef(true)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const response = await getProducts()
        setProducts(response.products || [])
        setLastUpdated(response.datetime)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Sort products locally
  const sortedProducts = useMemo(() => {
    const sorted = [...products]
    switch (sort) {
      case 'price-asc':
        sorted.sort((a, b) => a.price - b.price)
        break
      case 'price-desc':
        sorted.sort((a, b) => b.price - a.price)
        break
      case 'discount':
        sorted.sort((a, b) => {
          const discountA = a.regular_price > 0 ? (a.regular_price - a.price) / a.regular_price : 0
          const discountB = b.regular_price > 0 ? (b.regular_price - b.price) / b.regular_price : 0
          return discountB - discountA
        })
        break
      case 'recent':
      default:
        // Keep original order (most recent)
        break
    }
    return sorted
  }, [products, sort])

  // Pagination
  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE)
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return sortedProducts.slice(start, start + ITEMS_PER_PAGE)
  }, [sortedProducts, currentPage])

  // Reset to page 1 when sort changes (skip first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setCurrentPage(1)
    setSearchParams((params) => {
      params.delete('page')
      return params
    })
  }, [sort, setSearchParams])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setSearchParams((params) => {
      if (page === 1) {
        params.delete('page')
      } else {
        params.set('page', String(page))
      }
      return params
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Calculate stats from products
  const stats = useMemo(() => {
    const totalProducts = products.length
    const onSaleProducts = products.filter(p => p.price < p.regular_price)
    const productsOnSale = onSaleProducts.length
    const allTimeLows = products.filter(p => p.is_all_time_low).length

    // Calculate average discount for products on sale
    const averageDiscount = productsOnSale > 0
      ? Math.round(
          onSaleProducts.reduce((sum, p) => {
            const discount = ((p.regular_price - p.price) / p.regular_price) * 100
            return sum + discount
          }, 0) / productsOnSale
        )
      : 0

    return { totalProducts, productsOnSale, allTimeLows, averageDiscount }
  }, [products])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-12 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            Track <span className="text-primary">Uniqlo Canada</span> Prices
          </h1>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            Never miss a deal. Monitor price history, get alerts, and save money on your favorite Uniqlo products.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto">
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search for any product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 pl-12 text-base"
                />
              </div>
              <Button type="submit" size="lg">
                Search
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Stats Section */}
      {!isLoading && (
        <section className="py-8 border-b">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <Package className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalProducts}</p>
                    <p className="text-sm text-muted-foreground">Products Tracked</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <TrendingDown className="h-8 w-8 text-success" />
                  <div>
                    <p className="text-2xl font-bold">{stats.productsOnSale}</p>
                    <p className="text-sm text-muted-foreground">On Sale</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <Percent className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{stats.averageDiscount}%</p>
                    <p className="text-sm text-muted-foreground">Avg. Discount</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <TrendingDown className="h-8 w-8 text-success" />
                  <div>
                    <p className="text-2xl font-bold">{stats.allTimeLows}</p>
                    <p className="text-sm text-muted-foreground">All-Time Lows</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* Products Section */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
              <h2 className="text-2xl font-bold">All Products</h2>
              {lastUpdated && (
                <p className="text-sm text-muted-foreground">
                  Last updated: {new Date(lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <Select
                options={sortOptions}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-48"
              />
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {isLoading
              ? Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))
              : paginatedProducts.map((product) => (
                  <ProductCard key={product.product_id} product={product} />
                ))}
          </div>

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {/* First page */}
                {currentPage > 3 && (
                  <>
                    <Button
                      variant={currentPage === 1 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      className="w-10"
                    >
                      1
                    </Button>
                    {currentPage > 4 && <span className="px-2 text-muted-foreground">...</span>}
                  </>
                )}

                {/* Page numbers around current */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    if (totalPages <= 7) return true
                    if (page === 1 || page === totalPages) return false
                    return Math.abs(page - currentPage) <= 2
                  })
                  .map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="w-10"
                    >
                      {page}
                    </Button>
                  ))}

                {/* Last page */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span className="px-2 text-muted-foreground">...</span>}
                    <Button
                      variant={currentPage === totalPages ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      className="w-10"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Results Info */}
          {!isLoading && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, sortedProducts.length)} of {sortedProducts.length} products
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
