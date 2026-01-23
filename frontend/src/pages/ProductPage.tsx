import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PriceChart } from '@/components/PriceChart'
import { getProduct } from '@/lib/api'
import { formatPrice, formatDate, calculateDiscount } from '@/lib/utils'
import type { ProductDetail } from '@/types'

export function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return

      setIsLoading(true)
      setError(null)

      try {
        const productData = await getProduct(id)
        setProduct(productData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [id])

  if (isLoading) {
    return <ProductPageSkeleton />
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || 'The product you are looking for does not exist.'}</p>
          <Link to="/">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const discount = calculateDiscount(product.current_price, product.regular_price)
  const lowestPrice = product.lowest_price.lowest_price ?? product.current_price
  const highestPrice = product.highest_price.highest_price ?? product.current_price

  // Parse category for breadcrumb
  const categoryParts = product.datapoints[0]?.category?.split('/') || ['Unknown']
  const categoryName = categoryParts[categoryParts.length - 1]
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Link
        to="/"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Products
      </Link>

      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <span>{categoryName}</span>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Product Image */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
          <img
            src={`/api/product/${product.product_id}/image`}
            alt={product.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              e.currentTarget.nextElementSibling?.classList.remove('hidden')
            }}
          />
          <div className="hidden h-full w-full bg-gradient-to-br from-muted to-muted-foreground/20 items-center justify-center absolute inset-0 flex">
            <span className="text-muted-foreground">No Image Available</span>
          </div>
          {/* Badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            {product.is_all_time_low && (
              <Badge variant="success" className="text-sm">
                All-Time Low
              </Badge>
            )}
            {product.on_sale && !product.is_all_time_low && (
              <Badge variant="default" className="text-sm">
                On Sale
              </Badge>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{product.name}</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Product ID: {product.product_id}
          </p>

          {/* Price Card */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-4xl font-bold">
                  {formatPrice(product.current_price)}
                </span>
                {product.on_sale && (
                  <>
                    <span className="text-xl text-muted-foreground line-through">
                      {formatPrice(product.regular_price)}
                    </span>
                    <Badge variant="destructive" className="text-sm">
                      -{discount}%
                    </Badge>
                  </>
                )}
              </div>

              {/* Price Stats */}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-success" />
                  <div>
                    <p className="text-sm text-muted-foreground">Lowest</p>
                    <p className="font-semibold">{formatPrice(lowestPrice)}</p>
                    {product.lowest_price.lowest_price_datetime && (
                      <p className="text-xs text-muted-foreground">
                        {formatDate(product.lowest_price.lowest_price_datetime)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm text-muted-foreground">Highest</p>
                    <p className="font-semibold">{formatPrice(highestPrice)}</p>
                    {product.highest_price.highest_price_datetime && (
                      <p className="text-xs text-muted-foreground">
                        {formatDate(product.highest_price.highest_price_datetime)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Regular Price</span>
                  <span className="font-semibold">{formatPrice(product.regular_price)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full"
          >
            <Button variant="outline" className="w-full">
              <ExternalLink className="mr-2 h-4 w-4" />
              View on Uniqlo.ca
            </Button>
          </a>

          {/* Last Updated */}
          {product.datapoints.length > 0 && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Last updated: {formatDate(product.datapoints[product.datapoints.length - 1].datetime)}
            </p>
          )}
        </div>
      </div>

      {/* Price History Chart */}
      {product.datapoints.length > 0 && (
        <div className="mb-8">
          <PriceChart
            datapoints={product.datapoints}
            lowestPrice={lowestPrice}
            highestPrice={highestPrice}
            currentPrice={product.current_price}
          />
        </div>
      )}
    </div>
  )
}

function ProductPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Skeleton className="h-4 w-32 mb-6" />
      <Skeleton className="h-4 w-48 mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <Skeleton className="aspect-[3/4] rounded-xl" />
        <div>
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/3 mb-6" />
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-10 w-1/2 mb-4" />
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Skeleton className="h-[350px] rounded-xl mb-8" />
    </div>
  )
}
