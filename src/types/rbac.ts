import type { Database } from '@/types/database.types'

export type { PermissionKey, ModuleName } from '@/config/permissions'

export type RoleRow = Database['public']['Tables']['roles']['Row']
export type UserRoleRow = Database['public']['Tables']['user_roles']['Row']
export type UserPermissionRow = Database['public']['Tables']['user_permissions']['Row']

// `key` is GENERATED ALWAYS AS (module || '.' || action), so it is never null
// in practice even though the generated type marks it nullable.
export type PermissionRow = Omit<Database['public']['Tables']['permissions']['Row'], 'key'> & {
  key: string
}

/** Role list item enriched with counts for the roles table. */
export interface RoleWithStats extends RoleRow {
  permissionCount: number
  userCount: number
}

/** Role detail: definition + granted permission ids. */
export interface RoleDetail extends RoleRow {
  permissionIds: string[]
}

/** Member entry for the "users with this role" tab. */
export interface RoleMember {
  id: string
  fullName: string
  email: string | null
  role: string
}
