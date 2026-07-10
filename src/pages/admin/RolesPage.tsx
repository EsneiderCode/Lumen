import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Copy, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react'
import { ROUTES } from '@/config/routes'
import { Can } from '@/components/ui/Can'
import {
  createRole,
  deleteRole,
  duplicateRole,
  fetchRoles,
  syncPermissions,
  updateRole,
} from '@/services/rbacService'
import type { RoleWithStats } from '@/types/rbac'

const EMPTY_FORM = { name: '', description: '', autoGrantNew: false }

export function RolesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [roles, setRoles] = useState<RoleWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncedKeys, setSyncedKeys] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<RoleWithStats | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [duplicateSource, setDuplicateSource] = useState<RoleWithStats | null>(null)
  const [duplicateName, setDuplicateName] = useState('')

  async function loadRoles() {
    const { data, error } = await fetchRoles()
    if (error) setError(error)
    if (data) setRoles(data)
    setIsLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      // Auto-registration: new MODULE_REGISTRY entries are created in the
      // permissions table and granted to roles flagged auto_grant_new.
      const sync = await syncPermissions()
      if (!cancelled && sync.data && sync.data.length > 0) setSyncedKeys(sync.data)
      if (!cancelled) await loadRoles()
    }
    void bootstrap()
    return () => { cancelled = true }
  }, [])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    const { data, error } = await createRole({
      name: form.name.trim(),
      description: form.description.trim() || null,
      auto_grant_new: form.autoGrantNew,
    })
    setIsSaving(false)
    if (error) {
      setError(error)
      return
    }
    setShowForm(false)
    setForm(EMPTY_FORM)
    if (data) navigate(ROUTES.ADMIN.ROLES_DETAIL.replace(':id', data.id))
  }

  async function handleToggleActive(role: RoleWithStats) {
    setError(null)
    const { error } = await updateRole(role.id, { is_active: !role.is_active })
    if (error) setError(error)
    else await loadRoles()
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setIsDeleting(true)
    setError(null)
    const { error } = await deleteRole(confirmDelete.id)
    if (error) setError(error === 'SYSTEM_ROLE' ? t('roles.systemRoleProtected') : error)
    else await loadRoles()
    setConfirmDelete(null)
    setIsDeleting(false)
  }

  async function handleDuplicate(event: React.FormEvent) {
    event.preventDefault()
    if (!duplicateSource) return
    setIsSaving(true)
    setError(null)
    const { data, error } = await duplicateRole(duplicateSource.id, duplicateName.trim())
    setIsSaving(false)
    setDuplicateSource(null)
    setDuplicateName('')
    if (error) {
      setError(error)
      return
    }
    if (data) navigate(ROUTES.ADMIN.ROLES_DETAIL.replace(':id', data.id))
  }

  return (
    <div className="space-y-5">
      <div className="nx-page-header">
        <div>
          <h2 className="nx-page-title">{t('roles.title')}</h2>
          <p className="nx-label mt-2 tabular-nums">{t('roles.subtitle', { count: roles.length })}</p>
        </div>
        <Can permission="roles.create">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-s border border-line px-3 py-2 text-sm text-fg-2 transition-colors hover:border-accent hover:text-accent"
          >
            <Plus size={15} strokeWidth={1.5} />
            {t('roles.new')}
          </button>
        </Can>
      </div>

      {error && (
        <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          {error}
        </div>
      )}

      {syncedKeys.length > 0 && (
        <div className="rounded-s border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">
          {t('roles.syncedPermissions', { count: syncedKeys.length })}
          <span className="ml-2 font-mono text-xs">{syncedKeys.join(', ')}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-l border border-line bg-bg-1 p-4">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
            <p className="font-medium text-fg-1">{t('roles.createRole')}</p>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              className="flex h-8 w-8 items-center justify-center rounded-s border border-line text-fg-2 transition-colors hover:border-accent hover:text-accent"
            >
              <X size={15} strokeWidth={1.5} />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-3">{t('roles.name')}</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="w-full rounded-s border border-line-s bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-fg-3">{t('roles.description')}</span>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-s border border-line-s bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder={t('common.optional')}
              />
            </label>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={form.autoGrantNew}
                  onChange={(e) => setForm((f) => ({ ...f, autoGrantNew: e.target.checked }))}
                  className="h-4 w-4 rounded-s border-line bg-bg-2"
                />
                <span className="text-xs text-fg-2">{t('roles.autoGrantNew')}</span>
              </label>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 rounded-s bg-accent px-4 py-2 text-sm font-semibold text-fg-1 transition-colors disabled:opacity-50"
              >
                <Save size={15} strokeWidth={1.5} />
                {isSaving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-l border border-line bg-bg-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="nx-loader" />
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 nx-label">{t('roles.role')}</th>
                <th className="px-4 py-3 nx-label">{t('roles.permissions')}</th>
                <th className="px-4 py-3 nx-label">{t('roles.users')}</th>
                <th className="px-4 py-3 nx-label">{t('roles.status')}</th>
                <th className="px-4 py-3 nx-label text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-fg-2">
                        <ShieldCheck size={15} strokeWidth={1.5} />
                      </span>
                      <div>
                        <p className="font-medium text-fg-1">
                          {role.is_system ? t(`users.roles.${role.name}`, { defaultValue: role.name }) : role.name}
                          {role.is_system && (
                            <span className="ml-2 inline-flex rounded-full border border-line px-2 py-0.5 text-xs text-fg-3">
                              {t('roles.system')}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-fg-2">{role.description ?? '-'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-fg-1">{role.permissionCount}</td>
                  <td className="px-4 py-3 tabular-nums text-fg-1">{role.userCount}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${role.is_active ? 'border-ok/40 text-ok' : 'border-err/40 text-err'}`}>
                      {role.is_active ? t('roles.active') : t('roles.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.ADMIN.ROLES_DETAIL.replace(':id', role.id))}
                        className="rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                      >
                        {t('roles.open')}
                      </button>
                      <Can permission="roles.create">
                        <button
                          type="button"
                          onClick={() => { setDuplicateSource(role); setDuplicateName('') }}
                          className="rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                          title={t('roles.duplicate')}
                        >
                          <Copy size={13} strokeWidth={1.5} />
                        </button>
                      </Can>
                      {!role.is_system && (
                        <>
                          <Can permission="roles.edit">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(role)}
                              className="rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                            >
                              {role.is_active ? t('roles.deactivate') : t('roles.activate')}
                            </button>
                          </Can>
                          <Can permission="roles.delete">
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(role)}
                              className="rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                              title={t('roles.delete')}
                            >
                              <Trash2 size={13} strokeWidth={1.5} />
                            </button>
                          </Can>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 p-4">
          <div className="w-full max-w-sm rounded-l border border-line bg-bg-1 p-5">
            <h3 className="text-sm font-medium text-fg-1">{t('roles.deleteConfirmTitle')}</h3>
            <p className="mt-2 text-sm text-fg-2">
              {t('roles.deleteConfirmMessage', { name: confirmDelete.name, count: confirmDelete.userCount })}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting}
                className="rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-s border border-accent bg-accent/10 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
              >
                {isDeleting ? t('common.saving') : t('roles.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {duplicateSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 p-4">
          <form onSubmit={handleDuplicate} className="w-full max-w-sm rounded-l border border-line bg-bg-1 p-5">
            <h3 className="text-sm font-medium text-fg-1">
              {t('roles.duplicateTitle', { name: duplicateSource.name })}
            </h3>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-fg-3">{t('roles.newName')}</span>
              <input
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                required
                autoFocus
                className="w-full rounded-s border border-line-s bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDuplicateSource(null)}
                className="rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving || !duplicateName.trim()}
                className="rounded-s border border-accent bg-accent/10 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
              >
                {isSaving ? t('common.saving') : t('roles.duplicate')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
