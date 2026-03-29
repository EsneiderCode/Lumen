import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { UserRole } from '@/types/enums'

interface ProtectedRouteProps {
  allowedRoles: UserRole[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, role, isLoading } = useAuth()

  if (isLoading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (role && !allowedRoles.includes(role)) return <Navigate to="/login" replace />

  return <Outlet />
}
