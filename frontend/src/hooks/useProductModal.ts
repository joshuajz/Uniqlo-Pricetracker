import { useSearchParams } from 'react-router-dom'

export function useProductModal() {
  const [searchParams, setSearchParams] = useSearchParams()
  const modalId = searchParams.get('modal')

  const openModal = (productId: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('modal', productId)
      return next
    }, { replace: false })
  }

  const closeModal = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('modal')
      return next
    }, { replace: true })
  }

  return { modalId, openModal, closeModal }
}
