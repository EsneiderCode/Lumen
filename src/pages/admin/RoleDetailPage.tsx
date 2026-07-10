import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Save, ShieldCheck, UserMinus, UserPlus } from 'lucide-react'
import { ROUTES } from '@/config/routes'
import { MODULE_REGISTRY } from '@/config/permissions'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { Can } from '@/components/ui/Can'
import { fetchOperationalUsers, type OperationalUser } from '@/services/userService'
import {
  assignRole,
  fetchPermissions,
  fetchRole,
  fetchUsersByRole,
  removeRole,
  setRolePermissions,
  updateRole,
} from '@/services/rbacService'
import type { PermissionRow, RoleDetail, RoleMember } from '@/types/rbac'

type Tab = 'permissions' | 'users'

const MODULE_ORDER = MODULE_REGISTRY.map((entry) => entry.module as string)

function groupPermissions(permissions: PermissionRow[]): { module: string; items: PermissionRow[] }[] {
  const byModule = new Map<string, PermissionRow[]>()
  for (const permission of permissions) {
    const list = byModule.get(permission.module) ?? []
    list.push(permission)
    byModule.set(permission.module, list)
  }
  const known = MODULE_ORDER.filter((module) => byModule.has(module))
  const unknown = [...byModule.keys()].filter((module) => !MODULE_ORDER.includes(module)).sort()
  return [...known, ...unknown].map((module) => ({ module, items: byModule.get(module) ?? [] }))
}

export function RoleDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { refreshPermissions } = useAuth()
  const { can } = usePermissions()

  const [role, setRole] = useState<RoleDetail | null>(null)
  const [catalog, setCatalog] = useState<PermissionRow[]>([])
  const [members, setMembers] = useState<RoleMember[]>([])
  const [allUsers, setAllUsers] = useState<OperationalUser[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tab, setTab] = useState<Tab>('permissions')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [assignUserId, setAssignUserId] = useState('')

  const isAdminSystemRole = role?.is_system === true && role.name === 'admin'
  const canEdit = can('roles.edit') && !isAdminSystemRole

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const [roleRes, catalogRes, membersRes, usersRes] = await Promise.all([
        fetchRole(id!),
        fetchPermissions(),
        fetchUsersByRole(id!),
        fetchOperationalUsers(),
      ])
      if (cancelled) return
      const loadError = roleRes.error ?? catalogRes.error ?? membersRes.error ?? usersRes.error
      if (loadError) setError(loadError)
      if (roleRes.data) {
        setRole(roleRes.data)
        setName(roleRes.data.name)
        setDescription(roleRes.data.description ?? '')
        setSelectedIds(new Set(roleRes.data.permissionIds))
      }
      if (catalogRes.data) setCatalog(catalogRes.data)
      if (membersRes.data) setMembers(membersRes.data)
      if (usersRes.data) setAllUsers(usersRes.data)
      setIsLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  const groups = useMemo(() => groupPermissions(catalog), [catalog])

  const assignableUsers = useMemo(() => {
    const memberIds = new Set(members.map((member) => member.id))
    return allUsers.filter((user) => !memberIds.has(user.id))
  }, [allUsers, members])

  function togglePermission(permissionId: string) {
    if (!canEdit) return
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(permissionId)) next.delete(permissionId)
      else next.add(permissionId)
      return next
    })
  }

  function toggleModule(items: PermissionRow[]) {
    if (!canEdit) return
    setSelectedIds((current) => {
      const next = new Set(current)
      const allSelected = items.every((item) => next.has(item.id))
      for (const item of items) {
        if (allSelected) next.delete(item.id)
        else next.add(item.id)
      }
      return next
    })
  }

  async function handleSave() {
    if (!role) return
    setIsSaving(true)
    setError(null)
    setSavedAt(null)

    if (!role.is_system && (name.trim() !== role.name || description.trim() !== (role.description ?? ''))) {
      const { error } = await updateRole(role.id, {
        name: name.trim(),
        description: description.trim() || null,
      })
      if (error) {
        setError(error)
        setIsSaving(false)
        return
      }
    }

    const { error: permError } = await setRolePermissions(role.id, [...selectedIds])
    if (permError) {
      setError(permError)
      setIsSaving(false)
      return
    }

    // Own effective permissions may have changed with this role's grants.
    await refreshPermissions()
    const { data } = await fetchRole(role.id)
    if (data) {
      setRole(data)
      setSelectedIds(new Set(data.permissionIds))
    }
    setSavedAt(Date.now())
    setIsSaving(false)
  }

  async function handleAssign(event: React.FormEvent) {
    event.preventDefault()
    if (!role || !assignUserId) return
    setError(null)
    const { error } = await assignRole(assignUserId, role.id)
    if (error) {
      setError(error)
      return
    }
    setAssignUserId('')
    const { data } = await fetchUsersByRole(role.id)
    if (data) setMembers(data)
  }

  async function handleRemoveMember(member: RoleMember) {
    if (!role) return
    setError(null)
    const { error } = await removeRole(member.id, role.id)
    if (error) {
      setError(error)
      return
    }
    const { data } = await fetchUsersByRole(role.id)
    if (data) setMembers(data)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="nx-loader" />
      </div>
    )
  }

  if (!role) {
    return (
      <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
        {error ?? t('roles.notFound')}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="nx-page-header">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(ROUTES.ADMIN.ROLES)}
            className="flex h-8 w-8 items-center justify-center rounded-s border border-line text-fg-2 transition-colors hover:border-accent hover:text-accent"
            title={t('common.back')}
          >
            <ChevronLeft size={15} strokeWidth={1.5} />
          </button>
          <div>
            <h2 className="nx-page-title flex items-center gap-2">
              <ShieldCheck size={18} strokeWidth={1.5} className="text-fg-2" />
              {role.is_system ? t(`users.roles.${role.name}`, { defaultValue: role.name }) : role.name}
              {role.is_system && (
                <span className="inline-flex rounded-full border border-line px-2 py-0.5 text-xs text-fg-3">
                  {t('roles.system')}
                </span>
              )}
            </h2>
            <p className="nx-label mt-2 tabular-nums">
              {t('roles.detailSubtitle', { permissions: selectedIds.size, users: members.length })}
            </p>
          </div>
        </div>
        {canEdit && tab === 'permissions' && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-s bg-accent px-4 py-2 text-sm font-semibold text-fg-1 transition-colors disabled:opacity-50"
          >
            <Save size={15} strokeWidth={1.5} />
            {isSaving ? t('common.saving') : t('common.save')}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          {error}
        </div>
      )}
      {savedAt && !error && (
        <div className="rounded-s border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          {t('roles.saved')}
        </div>
      )}
      {isAdminSystemRole && (
        <div className="rounded-s border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">
          {t('roles.adminRoleHint')}
        </div>
      )}

      {!role.is_system && (
        <div className="rounded-l border border-line bg-bg-1 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-3">{t('roles.name')}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-s border border-line-s bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-3">{t('roles.description')}</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-s border border-line-s bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              />
            </label>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['permissions', 'users'] as Tab[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-s border px-3 py-1.5 text-xs transition-colors ${tab === key ? 'border-accent text-accent' : 'border-line text-fg-2 hover:border-accent hover:text-accent'}`}
          >
            {t(`roles.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'permissions' && (
        <div className="space-y-3">
          {groups.map(({ module, items }) => {
            const allSelected = items.every((item) => selectedIds.has(item.id))
            return (
              <div key={module} className="overflow-hidden rounded-l border border-line bg-bg-1">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <p className="font-medium text-fg-1">
                    {t(`roles.moduleNames.${module}`, { defaultValue: module })}
                  </p>
                  {canEdit && (
                    <label className="flex items-center gap-2 text-xs text-fg-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => toggleModule(items)}
                        className="h-4 w-4 rounded-s border-line bg-bg-2"
                      />
                      {t('roles.allModule')}
                    </label>
                  )}
                </div>
                <div className="grid gap-x-4 px-4 py-2 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((permission) => (
                    <label
                      key={permission.id}
                      className={`flex items-center gap-3 border-b border-line/50 py-2 last:border-0 ${canEdit ? 'cursor-pointer' : 'opacity-80'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isAdminSystemRole || selectedIds.has(permission.id)}
                        disabled={!canEdit}
                        onChange={() => togglePermission(permission.id)}
                        className="h-4 w-4 rounded-s border-line bg-bg-2"
                      />
                      <span>
                        <span className="block text-sm text-fg-1">
                          {t(`roles.actionNames.${permission.action}`, { defaultValue: permission.action })}
                        </span>
                        <span className="block font-mono text-xs text-fg-3">{permission.key}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-4">
          <Can permission="roles.assign">
            <form onSubmit={handleAssign} className="flex flex-wrap items-end gap-3 rounded-l border border-line bg-bg-1 p-4">
              <label className="block min-w-64 flex-1">
                <span className="mb-1 block text-xs font-medium text-fg-3">{t('roles.assignUser')}</span>
                <select
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  className="w-full rounded-s border border-line-s bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">{t('roles.selectUser')}</option>
                  {assignableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} {user.email ? `(${user.email})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={!assignUserId}
                className="flex items-center gap-2 rounded-s border border-line px-3 py-2 text-sm text-fg-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
              >
                <UserPlus size={15} strokeWidth={1.5} />
                {t('roles.assign')}
              </button>
            </form>
          </Can>

          <div className="overflow-hidden rounded-l border border-line bg-bg-1">
            {members.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-fg-2">{t('roles.noUsers')}</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="px-4 py-3 nx-label">{t('users.profile')}</th>
                    <th className="px-4 py-3 nx-label">{t('roles.basePersona')}</th>
                    <th className="px-4 py-3 nx-label text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    // The base persona assignment is managed via profiles.role
                    // (Personnel page) and re-synced by trigger — removing it
                    // here would be immediately undone.
                    const isBasePersona = role.is_system && member.role === role.name
                    return (
                      <tr key={member.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-medium text-fg-1">{member.fullName}</p>
                          <p className="text-xs text-fg-2">{member.email ?? '-'}</p>
                        </td>
                        <td className="px-4 py-3 text-fg-2">
                          {t(`users.roles.${member.role}`, { defaultValue: member.role })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Can permission="roles.assign">
                            {isBasePersona ? (
                              <span className="text-xs text-fg-3">{t('roles.basePersonaHint')}</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(member)}
                                className="inline-flex items-center gap-2 rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                              >
                                <UserMinus size={13} strokeWidth={1.5} />
                                {t('roles.removeUser')}
                              </button>
                            )}
                          </Can>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
