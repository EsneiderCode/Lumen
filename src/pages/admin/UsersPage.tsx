import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, KeyRound, Plus, Save, Trash2, UserRound, X } from 'lucide-react'
import type { TeamColor, UserRole } from '@/types/enums'
import { TEAM_COLOR_KEYS } from '@/i18n/labels'
import {
  createOperationalUser,
  deleteOperationalUser,
  fetchOperationalUsers,
  updateOperationalUser,
  type OperationalUser,
  type OperationalUserPayload,
} from '@/services/userService'
import { ContractorDocumentsPanel } from '@/components/contractor/ContractorDocumentsPanel'
import { UserAccessPanel } from '@/components/admin/UserAccessPanel'
import { Can } from '@/components/ui/Can'

const EMPTY_FORM = {
  id: '',
  fullName: '',
  email: '',
  password: '',
  role: 'technician' as UserRole,
  team: '' as TeamColor | '',
  isActive: true,
}

type UserForm = typeof EMPTY_FORM

function toForm(user: OperationalUser): UserForm {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email ?? '',
    password: '',
    role: user.role,
    team: user.team ?? '',
    isActive: user.is_active,
  }
}

function cleanPayload(form: UserForm): OperationalUserPayload {
  return {
    id: form.id || undefined,
    fullName: form.fullName.trim(),
    email: form.email.trim() || null,
    password: form.password || undefined,
    role: form.role,
    team: form.team || null,
    isActive: form.isActive,
  }
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('de-DE')
}

export function UsersPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<OperationalUser[]>([])
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [confirmDelete, setConfirmDelete] = useState<OperationalUser | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const isEditing = Boolean(form.id)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const { data, error } = await fetchOperationalUsers()
      if (cancelled) return
      if (error) setError(error)
      setUsers(data)
      setIsLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const filteredUsers = useMemo(() => {
    if (!roleFilter) return users
    return users.filter((user) => user.role === roleFilter)
  }, [users, roleFilter])

  function updateForm<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setError(null)
    setShowPassword(false)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    const payload = cleanPayload(form)
    const result = isEditing && payload.id
      ? await updateOperationalUser(payload as OperationalUserPayload & { id: string })
      : await createOperationalUser(payload)

    if (result.error) {
      setError(result.error)
    } else {
      setUsers(result.data)
      resetForm()
    }
    setIsSaving(false)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setIsDeleting(true)
    setError(null)
    const { data, error } = await deleteOperationalUser(confirmDelete.id)
    if (error) setError(error)
    else {
      setUsers(data)
      if (form.id === confirmDelete.id) resetForm()
    }
    setConfirmDelete(null)
    setIsDeleting(false)
  }

  async function toggleActive(user: OperationalUser) {
    setError(null)
    const { data, error } = await updateOperationalUser({
      id: user.id,
      isActive: !user.is_active,
    })
    if (error) setError(error)
    else setUsers(data)
  }

  return (
    <div className="space-y-5">
      <div className="nx-page-header">
        <div>
          <h2 className="nx-page-title">{t('users.title')}</h2>
          <p className="nx-label mt-2 tabular-nums">{t('users.subtitle', { count: users.length })}</p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="flex items-center gap-2 rounded-s border border-line px-3 py-2 text-sm text-fg-2 transition-colors hover:border-accent hover:text-accent"
        >
          <Plus size={15} strokeWidth={1.5} />
          {t('users.new')}
        </button>
      </div>

      {error && (
        <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-l border border-line bg-bg-1 p-4">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <p className="font-medium text-fg-1">{isEditing ? t('users.editProfile') : t('users.createProfile')}</p>
            <p className="text-xs text-fg-2">{t('users.pinHint')}</p>
          </div>
          {isEditing && (
            <button
              type="button"
              onClick={resetForm}
              className="flex h-8 w-8 items-center justify-center rounded-s border border-line text-fg-2 transition-colors hover:border-accent hover:text-accent"
              title={t('users.cancelEdit')}
            >
              <X size={15} strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg-3">{t('users.name')}</span>
            <input
              value={form.fullName}
              onChange={(e) => updateForm('fullName', e.target.value)}
              required
              className="w-full rounded-s border border-line-s bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg-3">{t('auth.email')}</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateForm('email', e.target.value)}
              className="w-full rounded-s border border-line-s bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder={t('common.optional')}
            />
          </label>

          <div className="block">
            <span className="mb-1 block text-xs font-medium text-fg-3">
              {t('auth.password')}{isEditing ? ` (${t('common.optional')})` : ''}
            </span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => updateForm('password', e.target.value)}
                required={!isEditing}
                minLength={6}
                className="w-full rounded-s border border-line-s bg-bg-2 px-3 py-2 pr-10 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder={isEditing ? t('users.passwordPlaceholder') : ''}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-3 transition-colors hover:text-fg-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg-3">{t('users.role')}</span>
            <select
              value={form.role}
              onChange={(e) => updateForm('role', e.target.value as UserRole)}
              className="w-full rounded-s border border-line-s bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="admin">{t('users.roles.admin')}</option>
              <option value="technician">{t('users.roles.technician')}</option>
              <option value="contractor">{t('users.roles.contractor')}</option>
              <option value="scheduler">{t('users.roles.scheduler')}</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg-3">{t('workOrder.team')}</span>
            <select
              value={form.team}
              onChange={(e) => updateForm('team', e.target.value as TeamColor | '')}
              className="w-full rounded-s border border-line-s bg-bg-2 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">{t('users.noTeam')}</option>
              {TEAM_COLOR_KEYS.map((color) => (
                <option key={color} value={color}>{t(`teamColor.${color}`)}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 pt-6">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => updateForm('isActive', e.target.checked)}
              className="h-4 w-4 rounded-s border-line bg-bg-2"
            />
            <span className="text-sm text-fg-2">{t('users.active')}</span>
          </label>

          <button
            type="submit"
            disabled={isSaving}
            className="mt-6 flex items-center justify-center gap-2 rounded-s bg-accent px-4 py-2 text-sm font-semibold text-fg-1 transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Save size={15} strokeWidth={1.5} />
            {isSaving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>

      {isEditing && form.role === 'contractor' && (
        <ContractorDocumentsPanel contractorId={form.id} canReview />
      )}

      {isEditing && (
        <Can permission="roles.assign">
          <UserAccessPanel userId={form.id} />
        </Can>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setRoleFilter('')}
          className={`rounded-s border px-3 py-1.5 text-xs transition-colors ${roleFilter === '' ? 'border-accent text-accent' : 'border-line text-fg-2 hover:border-accent hover:text-accent'}`}
        >
          {t('common.all')}
        </button>
        {(['admin', 'technician', 'contractor', 'scheduler'] as UserRole[]).map((role) => (
          <button
            key={role}
            onClick={() => setRoleFilter(role)}
            className={`rounded-s border px-3 py-1.5 text-xs transition-colors ${roleFilter === role ? 'border-accent text-accent' : 'border-line text-fg-2 hover:border-accent hover:text-accent'}`}
          >
            {t(`users.roles.${role}`)}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-l border border-line bg-bg-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="nx-loader" />
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 nx-label">{t('users.profile')}</th>
                <th className="px-4 py-3 nx-label">{t('users.role')}</th>
                <th className="px-4 py-3 nx-label">PIN</th>
                <th className="px-4 py-3 nx-label">{t('users.status')}</th>
                <th className="px-4 py-3 nx-label text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-fg-2">
                        <UserRound size={15} strokeWidth={1.5} />
                      </span>
                      <div>
                        <p className="font-medium text-fg-1">{user.full_name}</p>
                        <p className="text-xs text-fg-2">{user.email ?? '-'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-fg-1">{t(`users.roles.${user.role}`)}</p>
                    <p className="text-xs text-fg-2">{user.team ? t(`teamColor.${user.team}`) : t('users.noTeam')}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-fg-1">{user.pin_login_code ?? '-'}</p>
                    <p className="inline-flex items-center gap-1 text-xs text-fg-2">
                      <KeyRound size={12} strokeWidth={1.5} />
                      {t('users.pinSet')}: {formatDate(user.pin_set_at)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${user.is_active ? 'border-ok/40 text-ok' : 'border-err/40 text-err'}`}>
                      {user.is_active ? t('users.active') : t('users.inactive')}
                    </span>
                    <p className="mt-1 text-xs text-fg-2">{t('users.pinLogin')}: {formatDate(user.last_pin_login_at)}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => setForm(toForm(user))}
                        className="rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(user)}
                        className="rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                      >
                        {user.is_active ? t('users.deactivate') : t('users.activate')}
                      </button>
                      <Can permission="users.delete">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(user)}
                          className="rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                          title={t('users.delete')}
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                        </button>
                      </Can>
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
            <h3 className="text-sm font-medium text-fg-1">{t('users.deleteConfirmTitle')}</h3>
            <p className="mt-2 text-sm text-fg-2">
              {t('users.deleteConfirmMessage', { name: confirmDelete.full_name })}
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
                {isDeleting ? t('common.saving') : t('users.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
