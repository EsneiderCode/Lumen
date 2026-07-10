import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { getLandingRoute, type PermissionKey } from '@/config/permissions'

interface ProtectedRouteProps {
  /** Portal-access permission required for this route block (e.g. portal.admin.access). */
  requiredPermission: PermissionKey
}

export function ProtectedRoute({ requiredPermission }: ProtectedRouteProps) {
  const { user, can, permissions, isLoading } = useAuth()

  if (isLoading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (!can(requiredPermission)) {
    const landing = getLandingRoute(permissions)
    return <Navigate to={landing} replace />
  }

  return <Outlet />
}
