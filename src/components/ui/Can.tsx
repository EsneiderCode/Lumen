import type { ReactNode } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import type { PermissionKey } from '@/config/permissions'

interface CanProps {
  /** Render children only when the user holds this permission. */
  permission?: PermissionKey
  /** Alternative: render children when the user holds ANY of these. */
  anyOf?: PermissionKey[]
  children: ReactNode
}

/**
 * Permission gate for UI elements: `<Can permission="users.delete"><DeleteButton /></Can>`.
 * Hides its children entirely when the permission is missing.
 */
export function Can({ permission, anyOf, children }: CanProps) {
  const { can, canAny } = usePermissions()
  const allowed = permission ? can(permission) : anyOf ? canAny(anyOf) : false
  if (!allowed) return null
  return <>{children}</>
}
