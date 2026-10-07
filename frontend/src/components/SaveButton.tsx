import { Bookmark } from 'lucide-react'
import { useSavedProducts } from '../context/SavedProductsContext'
import type { Product } from '../types/types'

export default function SaveButton({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { products, toggle } = useSavedProducts()
  const saved = products.some(entry => entry.product.product_id === product.product_id)
  return <button type="button" className={compact ? 'save-product-button save-product-compact' : 'secondary-button save-product-button'}
    aria-label={saved ? `Remove ${product.name} from Saved` : `Save ${product.name}`} aria-pressed={saved}
    title={saved ? 'Remove from Saved' : 'Save product'} onClick={() => toggle(product)}>
    <Bookmark size={compact ? 20 : 18} aria-hidden="true" />{!compact && <span>{saved ? 'Saved' : 'Save product'}</span>}
  </button>
}
