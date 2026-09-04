import { Navigate, useLocation } from 'react-router-dom'

// Keep old shared links working without maintaining a second deals interface.
export default function DashboardPage() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/', search }} replace />
}
