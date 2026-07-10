import { supabase } from '@/lib/supabase'
import { registryToSyncPayload } from '@/config/permissions'
import type {
  PermissionRow,
  RoleDetail,
  RoleMember,
  RoleRow,
  RoleWithStats,
  UserPermissionRow,
  UserRoleRow,
} from '@/types/rbac'

const db = supabase

// ── Session permissions ───────────────────────────────────────────────────────

export async function fetchMyPermissions(): Promise<{ data: string[] | null; error: string | null }> {
  const { data, error } = await db.rpc('get_my_permissions')
  if (error) return { data: null, error: error.message }
  return { data: (data ?? []) as string[], error: null }
}

/**
 * Registers the frontend MODULE_REGISTRY in the permissions table. Missing
 * keys are created and auto-granted to roles flagged auto_grant_new.
 * Returns the newly created keys.
 */
export async function syncPermissions(): Promise<{ data: string[] | null; error: string | null }> {
  const { data, error } = await db.rpc('sync_permissions', { perms: registryToSyncPayload() })
  if (error) return { data: null, error: error.message }
  const created = (data as { created?: string[] } | null)?.created ?? []
  return { data: created, error: null }
}

// ── Permission catalog ────────────────────────────────────────────────────────

export async function fetchPermissions(): Promise<{ data: PermissionRow[] | null; error: string | null }> {
  const { data, error } = await db
    .from('permissions')
    .select('*')
    .order('module', { ascending: true })
    .order('action', { ascending: true })
  if (error) return { data: null, error: error.message }
  return { data: (data ?? []) as PermissionRow[], error: null }
}

// ── Roles CRUD ────────────────────────────────────────────────────────────────

export async function fetchRoles(): Promise<{ data: RoleWithStats[] | null; error: string | null }> {
  const [rolesRes, rolePermsRes, userRolesRes] = await Promise.all([
    db.from('roles').select('*').order('is_system', { ascending: false }).order('name'),
    db.from('role_permissions').select('role_id'),
    db.from('user_roles').select('role_id'),
  ])
  const error = rolesRes.error ?? rolePermsRes.error ?? userRolesRes.error
  if (error) return { data: null, error: error.message }

  const permCounts = new Map<string, number>()
  for (const row of (rolePermsRes.data ?? []) as { role_id: string }[]) {
    permCounts.set(row.role_id, (permCounts.get(row.role_id) ?? 0) + 1)
  }
  const userCounts = new Map<string, number>()
  for (const row of (userRolesRes.data ?? []) as { role_id: string }[]) {
    userCounts.set(row.role_id, (userCounts.get(row.role_id) ?? 0) + 1)
  }

  const roles = ((rolesRes.data ?? []) as RoleRow[]).map((role) => ({
    ...role,
    permissionCount: permCounts.get(role.id) ?? 0,
    userCount: userCounts.get(role.id) ?? 0,
  }))
  return { data: roles, error: null }
}

export async function fetchRole(roleId: string): Promise<{ data: RoleDetail | null; error: string | null }> {
  const [roleRes, permsRes] = await Promise.all([
    db.from('roles').select('*').eq('id', roleId).single(),
    db.from('role_permissions').select('permission_id').eq('role_id', roleId),
  ])
  const error = roleRes.error ?? permsRes.error
  if (error) return { data: null, error: error.message }
  const role = roleRes.data as RoleRow
  const permissionIds = ((permsRes.data ?? []) as { permission_id: string }[]).map(
    (row) => row.permission_id,
  )
  return { data: { ...role, permissionIds }, error: null }
}

export interface RolePayload {
  name: string
  description?: string | null
  is_active?: boolean
  auto_grant_new?: boolean
}

export async function createRole(payload: RolePayload): Promise<{ data: RoleRow | null; error: string | null }> {
  // Column defaults are set explicitly so the demo mock (which has no DB
  // defaults) behaves like production.
  const { data, error } = await db
    .from('roles')
    .insert({ description: null, is_active: true, auto_grant_new: false, ...payload, is_system: false })
    .select('*')
    .single()
  if (error) return { data: null, error: error.message }
  return { data: data as RoleRow, error: null }
}

export async function updateRole(
  roleId: string,
  payload: Partial<RolePayload>,
): Promise<{ data: RoleRow | null; error: string | null }> {
  const { data, error } = await db.from('roles').update(payload).eq('id', roleId).select('*').single()
  if (error) return { data: null, error: error.message }
  return { data: data as RoleRow, error: null }
}

export async function deleteRole(roleId: string): Promise<{ error: string | null }> {
  const { data: role, error: fetchError } = await db
    .from('roles')
    .select('is_system')
    .eq('id', roleId)
    .single()
  if (fetchError) return { error: fetchError.message }
  if ((role as RoleRow).is_system) return { error: 'SYSTEM_ROLE' }
  const { error } = await db.from('roles').delete().eq('id', roleId)
  return { error: error?.message ?? null }
}

export async function duplicateRole(
  roleId: string,
  newName: string,
): Promise<{ data: RoleRow | null; error: string | null }> {
  const { data: source, error: sourceError } = await fetchRole(roleId)
  if (sourceError || !source) return { data: null, error: sourceError ?? 'NOT_FOUND' }

  const { data: created, error: createError } = await createRole({
    name: newName,
    description: source.description,
    is_active: true,
    auto_grant_new: source.auto_grant_new,
  })
  if (createError || !created) return { data: null, error: createError ?? 'CREATE_FAILED' }

  if (source.permissionIds.length > 0) {
    const rows = source.permissionIds.map((permissionId) => ({
      role_id: created.id,
      permission_id: permissionId,
    }))
    const { error: grantError } = await db.from('role_permissions').insert(rows)
    if (grantError) return { data: created, error: grantError.message }
  }
  return { data: created, error: null }
}

/** Replaces a role's permission set with exactly the given permission ids. */
export async function setRolePermissions(
  roleId: string,
  permissionIds: string[],
): Promise<{ error: string | null }> {
  const { data: current, error: fetchError } = await db
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', roleId)
  if (fetchError) return { error: fetchError.message }

  const currentIds = new Set(
    ((current ?? []) as { permission_id: string }[]).map((row) => row.permission_id),
  )
  const targetIds = new Set(permissionIds)
  const toAdd = permissionIds.filter((id) => !currentIds.has(id))
  const toRemove = [...currentIds].filter((id) => !targetIds.has(id))

  if (toAdd.length > 0) {
    const { error } = await db
      .from('role_permissions')
      .insert(toAdd.map((permissionId) => ({ role_id: roleId, permission_id: permissionId })))
    if (error) return { error: error.message }
  }
  if (toRemove.length > 0) {
    const { error } = await db
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .in('permission_id', toRemove)
    if (error) return { error: error.message }
  }
  return { error: null }
}

// ── Role assignments ──────────────────────────────────────────────────────────

export async function fetchUsersByRole(roleId: string): Promise<{ data: RoleMember[] | null; error: string | null }> {
  const { data: assignments, error: assignError } = await db
    .from('user_roles')
    .select('user_id')
    .eq('role_id', roleId)
  if (assignError) return { data: null, error: assignError.message }

  const userIds = ((assignments ?? []) as UserRoleRow[]).map((row) => row.user_id)
  if (userIds.length === 0) return { data: [], error: null }

  const { data: profiles, error: profileError } = await db
    .from('profiles')
    .select('id, full_name, email, role')
    .in('id', userIds)
    .order('full_name')
  if (profileError) return { data: null, error: profileError.message }

  const members = ((profiles ?? []) as { id: string; full_name: string; email: string | null; role: string }[]).map(
    (profile) => ({
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      role: profile.role,
    }),
  )
  return { data: members, error: null }
}

export async function fetchUserRoleIds(userId: string): Promise<{ data: string[] | null; error: string | null }> {
  const { data, error } = await db.from('user_roles').select('role_id').eq('user_id', userId)
  if (error) return { data: null, error: error.message }
  return { data: ((data ?? []) as UserRoleRow[]).map((row) => row.role_id), error: null }
}

export async function assignRole(userId: string, roleId: string): Promise<{ error: string | null }> {
  const { error } = await db.from('user_roles').insert({ user_id: userId, role_id: roleId })
  if (error && !error.message.toLowerCase().includes('duplicate')) return { error: error.message }
  return { error: null }
}

export async function removeRole(userId: string, roleId: string): Promise<{ error: string | null }> {
  const { error } = await db.from('user_roles').delete().eq('user_id', userId).eq('role_id', roleId)
  return { error: error?.message ?? null }
}

// ── Direct user permission grants (additive overrides) ────────────────────────

export async function fetchUserDirectPermissions(
  userId: string,
): Promise<{ data: string[] | null; error: string | null }> {
  const { data, error } = await db.from('user_permissions').select('permission_id').eq('user_id', userId)
  if (error) return { data: null, error: error.message }
  return { data: ((data ?? []) as UserPermissionRow[]).map((row) => row.permission_id), error: null }
}

export async function grantUserPermission(userId: string, permissionId: string): Promise<{ error: string | null }> {
  const { error } = await db
    .from('user_permissions')
    .insert({ user_id: userId, permission_id: permissionId })
  if (error && !error.message.toLowerCase().includes('duplicate')) return { error: error.message }
  return { error: null }
}

export async function revokeUserPermission(userId: string, permissionId: string): Promise<{ error: string | null }> {
  const { error } = await db
    .from('user_permissions')
    .delete()
    .eq('user_id', userId)
    .eq('permission_id', permissionId)
  return { error: error?.message ?? null }
}
