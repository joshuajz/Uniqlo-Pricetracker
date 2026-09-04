import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

export function useProductModal() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const modalId = searchParams.get('modal')

  const openModal = (productId: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('modal', productId)
      return next
    }, { state: { productModalOrigin: location.pathname + location.search } })
  }
  const closeModal = () => {
    const base = new URLSearchParams(searchParams)
    base.delete('modal')
    const origin = location.pathname + (base.size ? `?${base}` : '')
    if (location.state?.productModalOrigin === origin) navigate(-1)
    else setSearchParams(base, { replace: true, state: null })
  }
  return { modalId, openModal, closeModal }
}
