import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getProducts } from '@/lib/api'
import type { Product } from '@/types'

interface CategoryInfo {
  slug: string
  name: string
  productCount: number
  onSaleCount: number
  allTimeLowCount: number
}

function formatCategoryName(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function CategoriesPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const response = await getProducts()
        setProducts(response.products || [])
      } catch (error) {
        console.error('Failed to fetch products:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const categories = useMemo(() => {
    const categoryMap = new Map<string, Product[]>()

    products.forEach((product) => {
      const existing = categoryMap.get(product.category) || []
      categoryMap.set(product.category, [...existing, product])
    })

    const categoryList: CategoryInfo[] = []
    categoryMap.forEach((categoryProducts, slug) => {
      categoryList.push({
        slug,
        name: formatCategoryName(slug),
        productCount: categoryProducts.length,
        onSaleCount: categoryProducts.filter((p) => p.price < p.regular_price).length,
        allTimeLowCount: categoryProducts.filter((p) => p.is_all_time_low).length,
      })
    })

    // Sort by product count descending
    return categoryList.sort((a, b) => b.productCount - a.productCount)
  }, [products])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Categories</h1>
        <p className="text-muted-foreground">
          Browse products by category
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <Link key={category.slug} to={`/category/${category.slug}`}>
              <Card className="group hover:shadow-lg transition-all hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Package className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold group-hover:text-primary transition-colors">
                          {category.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {category.productCount} products
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>

                  <div className="mt-4 flex gap-4 text-xs">
                    {category.onSaleCount > 0 && (
                      <span className="text-primary">
                        {category.onSaleCount} on sale
                      </span>
                    )}
                    {category.allTimeLowCount > 0 && (
                      <span className="text-success">
                        {category.allTimeLowCount} all-time low
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No categories found</h2>
          <p className="text-muted-foreground">
            No products have been loaded yet.
          </p>
        </div>
      )}
    </div>
  )
}
