import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { getLandingRoute, type PermissionKey } from '@/config/permissions'

interface ProtectedRouteProps {
  /**
   * Portal gate for this route block: either a portal-access permission
   * (e.g. portal.tech.access) or a predicate over the user's effective
   * permissions (admin panel access is derived, see hasAdminPanelAccess).
   */
  requiredPermission: PermissionKey | ((permissions: ReadonlySet<string>) => boolean)
}

export function ProtectedRoute({ requiredPermission }: ProtectedRouteProps) {
  const { user, can, permissions, isLoading } = useAuth()

  if (isLoading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />

  const allowed =
    typeof requiredPermission === 'function'
      ? requiredPermission(permissions)
      : can(requiredPermission)
  if (!allowed) {
    const landing = getLandingRoute(permissions)
    return <Navigate to={landing} replace />
  }

  return <Outlet />
}
