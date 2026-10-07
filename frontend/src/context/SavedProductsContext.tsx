import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useMarket } from './MarketContext'
import { addSavedProduct, parseSavedProducts, readSavedProducts, savedStorageKey, writeSavedProducts, type SavedProduct } from '../lib/saved-products'
import type { Product } from '../types/types'

interface SavedProductsValue {
  products: SavedProduct[]
  storageAvailable: boolean
  toggle: (product: Product) => void
  remove: (id: string) => void
}
const SavedProductsContext = createContext<SavedProductsValue | null>(null)
export const useSavedProducts = () => {
  const value = useContext(SavedProductsContext)
  if (!value) throw new Error('SavedProductsProvider is missing')
  return value
}

export function SavedStorageNotice() {
  const { storageAvailable } = useSavedProducts()
  return storageAvailable ? null : <p className="saved-storage-warning" role="status">Browser storage is unavailable. Your saved list will only stay while this page is open.</p>
}

export function SavedProductsProvider({ children }: { children: ReactNode }) {
  const market = useMarket()
  const [state, setState] = useState(() => {
    try { return readSavedProducts(window.localStorage, market) }
    catch { return { products: [] as SavedProduct[], available: false } }
  })
  const current = useRef(state)
  const [notice, setNotice] = useState<{ message: string; undo?: () => void } | null>(null)
  const set = (next: typeof state) => { current.current = next; setState(next) }
  const latest = () => {
    if (!current.current.available) return current.current.products
    try {
      const stored = readSavedProducts(window.localStorage, market)
      return stored.available ? stored.products : current.current.products
    } catch { return current.current.products }
  }
  const save = (products: SavedProduct[]) => {
    let available = false
    try { available = writeSavedProducts(window.localStorage, market, products) } catch { /* Keep the list in memory. */ }
    set({ products, available })
  }
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return
      if (event.key !== savedStorageKey(market) && event.key !== null) return
      set({ products: parseSavedProducts(event.newValue), available: true })
      setNotice(null)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [market])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 10000)
    return () => window.clearTimeout(timer)
  }, [notice])
  const remove = (id: string) => {
    const entries = latest()
    const removed = entries.find(entry => entry.product.product_id === id)
    if (!removed) return
    save(entries.filter(entry => entry.product.product_id !== id))
    setNotice({ message: 'Removed from Saved', undo: () => {
      const entries = latest()
      if (!entries.some(entry => entry.product.product_id === id)) save([...entries, removed])
      setNotice({ message: 'Restored to Saved' })
    } })
  }
  const toggle = (product: Product) => {
    const entries = latest()
    if (entries.some(entry => entry.product.product_id === product.product_id)) remove(product.product_id)
    else {
      save(addSavedProduct(entries, product))
      setNotice({ message: 'Added to Saved' })
    }
  }
  return <SavedProductsContext.Provider value={{ products: state.products, storageAvailable: state.available, toggle, remove }}>
    {children}
    <div className="saved-toast" role="status" aria-live="polite" aria-atomic="true" hidden={!notice}>
      {notice && <><span>{notice.message}</span>{notice.undo && <button type="button" onClick={notice.undo}>Undo</button>}
        <button type="button" className="saved-toast-close" onClick={() => setNotice(null)} aria-label="Dismiss saved notification"><X size={16} aria-hidden="true" /></button></>}
    </div>
  </SavedProductsContext.Provider>
}
