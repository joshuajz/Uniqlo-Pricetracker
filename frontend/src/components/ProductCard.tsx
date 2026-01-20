import { Link } from 'react-router-dom'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice, calculateDiscount } from '@/lib/utils'
import type { Product } from '@/types'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const discount = calculateDiscount(product.currentPrice, product.originalPrice)
  const isOnSale = product.currentPrice < product.originalPrice
  const isAllTimeLow = product.currentPrice <= product.lowestPrice

  return (
    <Link to={`/product/${product.id}`}>
      <Card className="group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
        {/* Image Container */}
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {isAllTimeLow && (
              <Badge variant="success" className="text-xs">
                All-Time Low
              </Badge>
            )}
            {isOnSale && !isAllTimeLow && (
              <Badge variant="default" className="text-xs">
                Sale
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="p-4">
          {/* Product Name */}
          <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>

          {/* Price Section */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">
                {formatPrice(product.currentPrice)}
              </span>
              {isOnSale && (
                <>
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                  <Badge variant="destructive" className="text-xs">
                    -{discount}%
                  </Badge>
                </>
              )}
            </div>

            {/* Lowest Price */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {product.currentPrice <= product.lowestPrice ? (
                <TrendingDown className="h-3 w-3 text-success" />
              ) : (
                <TrendingUp className="h-3 w-3 text-destructive" />
              )}
              <span>Lowest: {formatPrice(product.lowestPrice)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[3/4]" />
      <CardContent className="p-4">
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3 mb-3" />
        <Skeleton className="h-6 w-1/2 mb-1" />
        <Skeleton className="h-3 w-1/3" />
      </CardContent>
    </Card>
  )
}
