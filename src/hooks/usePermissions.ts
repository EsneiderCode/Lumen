import { useAuth } from '@/hooks/useAuth'
import type { PermissionKey } from '@/config/permissions'

/** Permission checks for the current user: `const { can } = usePermissions()`. */
export function usePermissions(): {
  can: (permission: PermissionKey) => boolean
  canAny: (permissions: PermissionKey[]) => boolean
  permissions: ReadonlySet<string>
} {
  const { can, permissions } = useAuth()
  return {
    can,
    canAny: (keys: PermissionKey[]) => keys.some((key) => can(key)),
    permissions,
  }
}
