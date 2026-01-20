import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PriceChart } from '@/components/PriceChart'
import { NotificationForm } from '@/components/NotificationForm'
import { getProduct, getPriceHistory } from '@/lib/api'
import { formatPrice, formatDate, calculateDiscount } from '@/lib/utils'
import type { Product, PricePoint } from '@/types'

export function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return

      setIsLoading(true)
      setError(null)

      try {
        const [productData, historyData] = await Promise.all([
          getProduct(id),
          getPriceHistory(id),
        ])
        setProduct(productData)
        setPriceHistory(historyData.history)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [id])

  const handleRangeChange = async (days: number | null) => {
    if (!id) return

    try {
      const historyData = await getPriceHistory(id, days ?? undefined)
      setPriceHistory(historyData.history)
    } catch (err) {
      console.error('Failed to fetch price history:', err)
    }
  }

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

  const discount = calculateDiscount(product.currentPrice, product.originalPrice)
  const isOnSale = product.currentPrice < product.originalPrice
  const isAllTimeLow = product.currentPrice <= product.lowestPrice

  // Parse category for breadcrumb
  const categoryParts = product.category.split('/')
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
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
          {/* Badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            {isAllTimeLow && (
              <Badge variant="success" className="text-sm">
                All-Time Low
              </Badge>
            )}
            {isOnSale && !isAllTimeLow && (
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
            Product ID: {product.id}
          </p>

          {/* Price Card */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-4xl font-bold">
                  {formatPrice(product.currentPrice)}
                </span>
                {isOnSale && (
                  <>
                    <span className="text-xl text-muted-foreground line-through">
                      {formatPrice(product.originalPrice)}
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
                    <p className="font-semibold">{formatPrice(product.lowestPrice)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(product.lowestPriceDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm text-muted-foreground">Highest</p>
                    <p className="font-semibold">{formatPrice(product.highestPrice)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(product.highestPriceDate)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Average Price</span>
                  <span className="font-semibold">{formatPrice(product.averagePrice)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <a
            href={product.productUrl}
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
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Last updated: {formatDate(product.lastUpdated)}
          </p>
        </div>
      </div>

      {/* Price History Chart */}
      <div className="mb-8">
        <PriceChart
          history={priceHistory}
          lowestPrice={product.lowestPrice}
          highestPrice={product.highestPrice}
          currentPrice={product.currentPrice}
          onRangeChange={handleRangeChange}
        />
      </div>

      {/* Notification Form */}
      <div className="max-w-md mx-auto">
        <NotificationForm
          productId={product.id}
          currentPrice={product.currentPrice}
          lowestPrice={product.lowestPrice}
        />
      </div>
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
