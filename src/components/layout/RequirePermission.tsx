import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { usePermissions } from '@/hooks/usePermissions'
import { getLandingRoute, type PermissionKey } from '@/config/permissions'

interface RequirePermissionProps {
  permission: PermissionKey
  children: ReactNode
}

/**
 * Page-level permission guard (blocks direct URL access). Rendered inside a
 * ProtectedRoute, so the user is already authenticated; on missing permission
 * they are sent to the first route they may land on.
 */
export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { can, permissions } = usePermissions()
  if (!can(permission)) return <Navigate to={getLandingRoute(permissions)} replace />
  return <>{children}</>
}
