import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, TrendingDown, Package, Percent } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard'
import { getProducts, getStats } from '@/lib/api'
import type { Product, Stats, Pagination } from '@/types'

const sortOptions = [
  { value: 'recent', label: 'Recently Updated' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'discount', label: 'Biggest Discount' },
]

export function HomePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sort, setSort] = useState(searchParams.get('sort') || 'recent')

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [productsData, statsData] = await Promise.all([
          getProducts({ sort, limit: 12 }),
          getStats(),
        ])
        setProducts(productsData.data)
        setPagination(productsData.pagination)
        setStats(statsData)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [sort])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const handleLoadMore = async () => {
    if (!pagination?.hasNext) return

    try {
      const nextPage = await getProducts({
        sort,
        page: pagination.page + 1,
        limit: 12,
      })
      setProducts((prev) => [...prev, ...nextPage.data])
      setPagination(nextPage.pagination)
    } catch (error) {
      console.error('Failed to load more:', error)
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
      {stats && (
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
            <h2 className="text-2xl font-bold">All Products</h2>
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
              ? Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))
              : products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
          </div>

          {/* Load More */}
          {pagination?.hasNext && (
            <div className="mt-8 text-center">
              <Button variant="outline" onClick={handleLoadMore}>
                Load More Products
              </Button>
            </div>
          )}

          {/* Results Info */}
          {pagination && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Showing {products.length} of {pagination.total} products
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
