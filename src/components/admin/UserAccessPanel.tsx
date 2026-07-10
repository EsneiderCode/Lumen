import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, ShieldCheck, X } from 'lucide-react'
import {
  assignRole,
  fetchPermissions,
  fetchRoles,
  fetchUserDirectPermissions,
  fetchUserRoleIds,
  grantUserPermission,
  removeRole,
  revokeUserPermission,
} from '@/services/rbacService'
import type { PermissionRow, RoleWithStats } from '@/types/rbac'

interface UserAccessPanelProps {
  userId: string
}

/**
 * Per-user access editor shown in the Personnel form while editing: additional
 * roles beyond the base persona, and direct permission grants (additive only).
 */
export function UserAccessPanel({ userId }: UserAccessPanelProps) {
  const { t } = useTranslation()
  const [roles, setRoles] = useState<RoleWithStats[]>([])
  const [userRoleIds, setUserRoleIds] = useState<Set<string>>(new Set())
  const [catalog, setCatalog] = useState<PermissionRow[]>([])
  const [directPermissionIds, setDirectPermissionIds] = useState<Set<string>>(new Set())
  const [grantPermissionId, setGrantPermissionId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const [rolesRes, userRolesRes, catalogRes, directRes] = await Promise.all([
        fetchRoles(),
        fetchUserRoleIds(userId),
        fetchPermissions(),
        fetchUserDirectPermissions(userId),
      ])
      if (cancelled) return
      const loadError = rolesRes.error ?? userRolesRes.error ?? catalogRes.error ?? directRes.error
      if (loadError) setError(loadError)
      if (rolesRes.data) setRoles(rolesRes.data)
      if (userRolesRes.data) setUserRoleIds(new Set(userRolesRes.data))
      if (catalogRes.data) setCatalog(catalogRes.data)
      if (directRes.data) setDirectPermissionIds(new Set(directRes.data))
      setIsLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [userId])

  // Base personas are managed through the profile's role field; only custom
  // roles are toggled here.
  const customRoles = useMemo(() => roles.filter((role) => !role.is_system && role.is_active), [roles])

  const permissionsById = useMemo(() => new Map(catalog.map((row) => [row.id, row])), [catalog])
  const grantablePermissions = useMemo(
    () => catalog.filter((row) => !directPermissionIds.has(row.id)),
    [catalog, directPermissionIds],
  )

  async function toggleRole(role: RoleWithStats) {
    setError(null)
    const hasRole = userRoleIds.has(role.id)
    const { error } = hasRole ? await removeRole(userId, role.id) : await assignRole(userId, role.id)
    if (error) {
      setError(error)
      return
    }
    setUserRoleIds((current) => {
      const next = new Set(current)
      if (hasRole) next.delete(role.id)
      else next.add(role.id)
      return next
    })
  }

  async function handleGrant(event: React.FormEvent) {
    event.preventDefault()
    if (!grantPermissionId) return
    setError(null)
    const { error } = await grantUserPermission(userId, grantPermissionId)
    if (error) {
      setError(error)
      return
    }
    setDirectPermissionIds((current) => new Set(current).add(grantPermissionId))
    setGrantPermissionId('')
  }

  async function handleRevoke(permissionId: string) {
    setError(null)
    const { error } = await revokeUserPermission(userId, permissionId)
    if (error) {
      setError(error)
      return
    }
    setDirectPermissionIds((current) => {
      const next = new Set(current)
      next.delete(permissionId)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="rounded-l border border-line bg-bg-1 p-4">
        <div className="flex items-center justify-center py-6">
          <div className="nx-loader" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-l border border-line bg-bg-1 p-4">
      <div className="mb-4 border-b border-line pb-3">
        <p className="flex items-center gap-2 font-medium text-fg-1">
          <ShieldCheck size={15} strokeWidth={1.5} />
          {t('roles.userAccessTitle')}
        </p>
        <p className="text-xs text-fg-2">{t('roles.userAccessHint')}</p>
      </div>

      {error && (
        <div className="mb-3 rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium text-fg-3">{t('roles.extraRoles')}</p>
          {customRoles.length === 0 ? (
            <p className="text-sm text-fg-2">{t('roles.noCustomRoles')}</p>
          ) : (
            <div className="space-y-1">
              {customRoles.map((role) => (
                <label key={role.id} className="flex cursor-pointer items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    checked={userRoleIds.has(role.id)}
                    onChange={() => toggleRole(role)}
                    className="h-4 w-4 rounded-s border-line bg-bg-2"
                  />
                  <span className="text-sm text-fg-1">{role.name}</span>
                  {role.description && <span className="text-xs text-fg-3">{role.description}</span>}
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-fg-3">{t('roles.directPermissions')}</p>
          <form onSubmit={handleGrant} className="mb-2 flex gap-2">
            <select
              value={grantPermissionId}
              onChange={(e) => setGrantPermissionId(e.target.value)}
              className="min-w-0 flex-1 rounded-s border border-line-s bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">{t('roles.selectPermission')}</option>
              {grantablePermissions.map((permission) => (
                <option key={permission.id} value={permission.id}>
                  {permission.key}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!grantPermissionId}
              className="rounded-s border border-line px-3 py-2 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {t('roles.grant')}
            </button>
          </form>
          {directPermissionIds.size === 0 ? (
            <p className="text-sm text-fg-2">{t('roles.noDirectPermissions')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[...directPermissionIds].map((permissionId) => {
                const permission = permissionsById.get(permissionId)
                if (!permission) return null
                return (
                  <span
                    key={permissionId}
                    className="inline-flex items-center gap-2 rounded-full border border-line px-2 py-1 font-mono text-xs text-fg-1"
                  >
                    <KeyRound size={11} strokeWidth={1.5} className="text-fg-3" />
                    {permission.key}
                    <button
                      type="button"
                      onClick={() => handleRevoke(permissionId)}
                      className="text-fg-3 transition-colors hover:text-accent"
                      title={t('roles.revoke')}
                    >
                      <X size={11} strokeWidth={1.5} />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
