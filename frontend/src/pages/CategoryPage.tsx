import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
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

function formatCategoryName(path: string): string {
  // Get the last segment of the path (e.g., "men/tops" -> "tops")
  const slug = path.split('/').pop() || path
  // Format the slug (e.g., "sweaters-and-knitwear" -> "Sweaters And Knitwear")
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function CategoryPage() {
  const { '*': categoryPath } = useParams()
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sort, setSort] = useState('recent')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const response = await getProducts()
        setAllProducts(response.products || [])
      } catch (error) {
        console.error('Failed to fetch products:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Filter products by category path
  const categoryProducts = useMemo(() => {
    if (!categoryPath) return []
    return allProducts.filter((p) => p.category === categoryPath)
  }, [allProducts, categoryPath])

  // Sort products
  const sortedProducts = useMemo(() => {
    const sorted = [...categoryProducts]
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
      default:
        break
    }
    return sorted
  }, [categoryProducts, sort])

  // Pagination
  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE)
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return sortedProducts.slice(start, start + ITEMS_PER_PAGE)
  }, [sortedProducts, currentPage])

  // Reset page when sort or category changes
  useEffect(() => {
    setCurrentPage(1)
  }, [sort, categoryPath])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const categoryName = categoryPath ? formatCategoryName(categoryPath) : 'Category'

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Link */}
      <Link
        to="/categories"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Categories
      </Link>

      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/categories" className="hover:text-foreground">Categories</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{categoryName}</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">{categoryName}</h1>
          {!isLoading && (
            <p className="text-sm text-muted-foreground">
              {sortedProducts.length} products
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

      {/* Empty State */}
      {!isLoading && sortedProducts.length === 0 && (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">No products found</h2>
          <p className="text-muted-foreground">
            No products in this category yet.
          </p>
        </div>
      )}

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
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                if (totalPages <= 7) return true
                return Math.abs(page - currentPage) <= 2 || page === 1 || page === totalPages
              })
              .map((page, idx, arr) => (
                <span key={page} className="flex items-center">
                  {idx > 0 && arr[idx - 1] !== page - 1 && (
                    <span className="px-2 text-muted-foreground">...</span>
                  )}
                  <Button
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="w-10"
                  >
                    {page}
                  </Button>
                </span>
              ))}
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
      {!isLoading && sortedProducts.length > 0 && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, sortedProducts.length)} of {sortedProducts.length} products
        </p>
      )}
    </div>
  )
}
