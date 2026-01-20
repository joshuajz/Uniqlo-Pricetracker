import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Search, ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard'
import { searchProducts } from '@/lib/api'
import type { Product, Pagination } from '@/types'

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [products, setProducts] = useState<Product[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchInput, setSearchInput] = useState(query)

  useEffect(() => {
    const fetchResults = async () => {
      if (!query) {
        setProducts([])
        setPagination(null)
        return
      }

      setIsLoading(true)
      try {
        const results = await searchProducts(query, { limit: 12 })
        setProducts(results.data)
        setPagination(results.pagination)
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchResults()
    setSearchInput(query)
  }, [query])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setSearchParams({ q: searchInput.trim() })
    }
  }

  const handleLoadMore = async () => {
    if (!pagination?.hasNext || !query) return

    try {
      const nextPage = await searchProducts(query, {
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
    <div className="container mx-auto px-4 py-8">
      {/* Back Link */}
      <Link
        to="/"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Home
      </Link>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search for products..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-12 pl-12 text-base"
            />
          </div>
          <Button type="submit" size="lg">
            Search
          </Button>
        </div>
      </form>

      {/* Search Results */}
      {query && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold">
              Search results for "{query}"
            </h1>
            {pagination && (
              <p className="text-muted-foreground mt-1">
                {pagination.total} {pagination.total === 1 ? 'product' : 'products'} found
              </p>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Load More */}
              {pagination?.hasNext && (
                <div className="mt-8 text-center">
                  <Button variant="outline" onClick={handleLoadMore}>
                    Load More Results
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No products found</h2>
              <p className="text-muted-foreground mb-6">
                We couldn't find any products matching "{query}".
              </p>
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">Try:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Using different keywords</li>
                  <li>Searching for a product ID (e.g., E482305)</li>
                  <li>Browsing categories instead</li>
                </ul>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State - No Query */}
      {!query && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Search for products</h2>
          <p className="text-muted-foreground">
            Enter a product name, category, or ID to find what you're looking for.
          </p>
        </div>
      )}
    </div>
  )
}
