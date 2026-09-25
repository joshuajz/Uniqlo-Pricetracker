import { useMarket } from '../context/MarketContext'
import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { productImageUrl } from '../data/api'

export default function ProductImage({ id, name, eager = false }: { id: string; name?: string; eager?: boolean }) {
  const market = useMarket()
  const [failed, setFailed] = useState(false)
  return failed ? (
    <span className="product-image image-fallback" role="img" aria-label={name ? `${name}: image unavailable` : 'Image unavailable'}>
      <ImageOff size={20} aria-hidden="true" /><span>Image unavailable</span>
    </span>
  ) : (
    <img className="product-image" src={productImageUrl(id, market)} alt={name ?? ''}
      loading={eager ? 'eager' : 'lazy'} decoding="async" width={90} height={120}
      onError={() => setFailed(true)} />
  )
}
