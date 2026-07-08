import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { Role } from '../types'

interface Props {
  children: React.ReactNode
  roles?: Role[]
}

export function ProtectedRoute({ children, roles }: Props) {
  const { token, user } = useAuthStore()

  if (!token || !user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/menu" replace />
  }

  return <>{children}</>
}
