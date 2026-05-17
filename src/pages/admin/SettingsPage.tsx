import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckSquare, Pencil, Plus, Send, Square, Trash2 } from 'lucide-react'
import {
  createGroup,
  deleteGroup,
  fetchGroups,
  fetchMappings,
  setMapping,
  updateGroup,
  validateChatId,
  TELEGRAM_EVENT_TYPES,
  TELEGRAM_GROUP_PURPOSES,
  type EventGroupMapping,
  type GroupPayload,
  type TelegramEventType,
  type TelegramGroup,
  type TelegramGroupPurpose,
} from '@/services/telegramGroupService'

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_FORM: GroupPayload = {
  chat_id: '',
  name: '',
  purpose: 'notificaciones',
  is_active: true,
}

type FormMode = 'idle' | 'add' | { edit: TelegramGroup }

type ValidationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; title: string }
  | { status: 'error' }

// ── SettingsPage ──────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { t } = useTranslation()

  const [groups, setGroups] = useState<TelegramGroup[]>([])
  const [mappings, setMappings] = useState<EventGroupMapping[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)

  const [mode, setMode] = useState<FormMode>('idle')
  const [form, setForm] = useState<GroupPayload>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [validation, setValidation] = useState<ValidationState>({ status: 'idle' })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoadingData(true)
    setDataError(null)
    try {
      const [g, m] = await Promise.all([fetchGroups(), fetchMappings()])
      setGroups(g)
      setMappings(m)
    } catch {
      setDataError(t('common.error'))
    } finally {
      setLoadingData(false)
    }
  }, [t])

  useEffect(() => { void load() }, [load])

  // ── Form helpers ───────────────────────────────────────────────────────────

  function openAdd() {
    setMode('add')
    setForm(EMPTY_FORM)
    setSaveError(null)
    setValidation({ status: 'idle' })
  }

  function openEdit(group: TelegramGroup) {
    setMode({ edit: group })
    setForm({
      chat_id: group.chat_id,
      name: group.name,
      purpose: group.purpose,
      is_active: group.is_active,
    })
    setSaveError(null)
    setValidation({ status: 'idle' })
  }

  function closeForm() {
    setMode('idle')
    setSaveError(null)
    setValidation({ status: 'idle' })
  }

  function setField<K extends keyof GroupPayload>(key: K, value: GroupPayload[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (key === 'chat_id') setValidation({ status: 'idle' })
  }

  // ── Validate chat ID ───────────────────────────────────────────────────────

  async function handleValidate() {
    if (!form.chat_id.trim()) return
    setValidation({ status: 'loading' })
    const result = await validateChatId(form.chat_id.trim())
    setValidation(result.ok ? { status: 'ok', title: result.title ?? form.chat_id } : { status: 'error' })
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaveError(null)
    setSaving(true)
    try {
      const payload: GroupPayload = {
        chat_id: form.chat_id.trim(),
        name: form.name.trim(),
        purpose: form.purpose,
        is_active: form.is_active,
      }
      if (typeof mode === 'object' && 'edit' in mode) {
        const updated = await updateGroup(mode.edit.id, payload)
        setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
      } else {
        const created = await createGroup(payload)
        setGroups((prev) => [...prev, created])
      }
      closeForm()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!window.confirm(t('settings.telegram.groups.confirmDelete'))) return
    setDeletingId(id)
    try {
      await deleteGroup(id)
      setGroups((prev) => prev.filter((g) => g.id !== id))
      setMappings((prev) => prev.filter((m) => m.telegram_group_id !== id))
    } catch {
      // non-critical — reload to sync
      void load()
    } finally {
      setDeletingId(null)
    }
  }

  // ── Mapping toggle ─────────────────────────────────────────────────────────

  async function handleToggleMapping(eventType: TelegramEventType, groupId: string) {
    const key = `${eventType}:${groupId}`
    setTogglingKey(key)
    const currently = mappings.some(
      (m) => m.event_type === eventType && m.telegram_group_id === groupId && m.is_active,
    )
    try {
      await setMapping(eventType, groupId, !currently)
      // Optimistic update
      if (currently) {
        setMappings((prev) =>
          prev.filter((m) => !(m.event_type === eventType && m.telegram_group_id === groupId)),
        )
      } else {
        setMappings((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            event_type: eventType,
            telegram_group_id: groupId,
            is_active: true,
            created_at: new Date().toISOString(),
          },
        ])
      }
    } catch {
      void load()
    } finally {
      setTogglingKey(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isEditing = typeof mode === 'object' && 'edit' in mode
  const formOpen = mode !== 'idle'

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="nx-page-header">
        <div>
          <h2 className="nx-page-title">{t('nav.settings')}</h2>
          <p className="nx-label mt-2">{t('settings.subtitle')}</p>
        </div>
      </div>

      {dataError && (
        <p className="text-sm text-gf-danger">{dataError}</p>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Section 1 — Telegram groups CRUD
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-gf-card border border-gf-border bg-gf-card">
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-gf-border px-5 py-4">
          <div>
            <h3 className="text-sm font-medium text-gf-text">{t('settings.telegram.groups.title')}</h3>
            <p className="mt-0.5 text-xs text-gf-text-muted">{t('settings.telegram.subtitle')}</p>
          </div>
          {!formOpen && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 rounded-gf-btn border border-gf-border bg-transparent px-3 py-1.5 text-xs text-gf-text transition-colors duration-150 hover:border-gf-primary hover:text-gf-primary"
            >
              <Plus size={13} strokeWidth={1.5} />
              {t('settings.telegram.groups.add')}
            </button>
          )}
        </div>

        {/* ── Inline form ── */}
        {formOpen && (
          <div className="border-b border-gf-border bg-gf-base-light px-5 py-4">
            <p className="mb-4 text-xs font-medium text-gf-text-muted">
              {isEditing ? t('settings.telegram.groups.edit') : t('settings.telegram.groups.add')}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Chat ID */}
              <div className="sm:col-span-2">
                <label className="nx-label mb-1.5 block">{t('settings.telegram.groups.chatId')}</label>
                <div className="flex gap-2">
                  <input
                    className="nx-input flex-1"
                    value={form.chat_id}
                    onChange={(e) => setField('chat_id', e.target.value)}
                    placeholder={t('settings.telegram.groups.chatIdPlaceholder')}
                    disabled={isEditing}
                  />
                  <button
                    onClick={handleValidate}
                    disabled={!form.chat_id.trim() || validation.status === 'loading'}
                    className="flex items-center gap-1.5 rounded-gf-btn border border-gf-border px-3 py-1.5 text-xs text-gf-text-muted transition-colors duration-150 hover:border-gf-primary hover:text-gf-primary disabled:opacity-40"
                  >
                    <Send size={12} strokeWidth={1.5} />
                    {validation.status === 'loading'
                      ? t('settings.telegram.groups.validating')
                      : t('settings.telegram.groups.validate')}
                  </button>
                </div>
                {validation.status === 'ok' && (
                  <p className="mt-1 text-xs text-gf-success">
                    {t('settings.telegram.groups.validOk', { title: validation.title })}
                  </p>
                )}
                {validation.status === 'error' && (
                  <p className="mt-1 text-xs text-gf-danger">{t('settings.telegram.groups.validFail')}</p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="nx-label mb-1.5 block">{t('settings.telegram.groups.name')}</label>
                <input
                  className="nx-input w-full"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder={t('settings.telegram.groups.namePlaceholder')}
                />
              </div>

              {/* Purpose */}
              <div>
                <label className="nx-label mb-1.5 block">{t('settings.telegram.groups.purpose')}</label>
                <select
                  className="nx-input w-full"
                  value={form.purpose}
                  onChange={(e) => setField('purpose', e.target.value as TelegramGroupPurpose)}
                >
                  {TELEGRAM_GROUP_PURPOSES.map((p) => (
                    <option key={p} value={p}>
                      {t(`settings.telegram.groups.purposes.${p}`)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <label className="nx-label">{t('settings.telegram.groups.status')}</label>
                <button
                  onClick={() => setField('is_active', !form.is_active)}
                  className={`relative h-5 w-9 rounded-full transition-colors duration-150 ${
                    form.is_active ? 'bg-gf-success' : 'bg-gf-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-gf-text transition-transform duration-150 ${
                      form.is_active ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="text-xs text-gf-text-muted">
                  {form.is_active
                    ? t('settings.telegram.groups.active')
                    : t('settings.telegram.groups.inactive')}
                </span>
              </div>
            </div>

            {saveError && <p className="mt-3 text-xs text-gf-danger">{saveError}</p>}

            {/* Form actions */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !form.chat_id.trim() || !form.name.trim()}
                className="rounded-gf-btn bg-gf-primary px-4 py-1.5 text-xs font-medium text-gf-base transition-opacity duration-150 hover:opacity-80 disabled:opacity-40"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
              <button
                onClick={closeForm}
                disabled={saving}
                className="rounded-gf-btn border border-gf-border px-4 py-1.5 text-xs text-gf-text-muted transition-colors duration-150 hover:text-gf-text"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* ── Groups table ── */}
        {loadingData ? (
          <p className="px-5 py-8 text-xs text-gf-text-muted">[{t('common.loading')}]</p>
        ) : groups.length === 0 ? (
          <p className="px-5 py-8 text-xs text-gf-text-muted">{t('settings.telegram.groups.empty')}</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gf-border text-left text-gf-text-muted">
                <th className="px-5 py-2.5 font-mono font-normal">Chat ID</th>
                <th className="px-3 py-2.5 font-mono font-normal">{t('settings.telegram.groups.name')}</th>
                <th className="px-3 py-2.5 font-mono font-normal">{t('settings.telegram.groups.purpose')}</th>
                <th className="px-3 py-2.5 font-mono font-normal">{t('settings.telegram.groups.status')}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-b border-gf-border last:border-0">
                  <td className="px-5 py-3 font-mono text-gf-text-muted">{g.chat_id}</td>
                  <td className="px-3 py-3 text-gf-text">{g.name}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full border border-gf-border px-2 py-0.5 text-gf-text-muted">
                      {t(`settings.telegram.groups.purposes.${g.purpose}`)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`font-mono text-xs ${
                        g.is_active ? 'text-gf-success' : 'text-gf-text-muted'
                      }`}
                    >
                      {g.is_active
                        ? t('settings.telegram.groups.active')
                        : t('settings.telegram.groups.inactive')}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(g)}
                        className="text-gf-text-muted transition-colors duration-150 hover:text-gf-text"
                        title={t('common.edit')}
                      >
                        <Pencil size={13} strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => handleDelete(g.id)}
                        disabled={deletingId === g.id}
                        className="text-gf-text-muted transition-colors duration-150 hover:text-gf-danger disabled:opacity-40"
                        title={t('common.delete')}
                      >
                        <Trash2 size={13} strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          Section 2 — Event → Group mappings
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-gf-card border border-gf-border bg-gf-card">
        <div className="border-b border-gf-border px-5 py-4">
          <h3 className="text-sm font-medium text-gf-text">{t('settings.telegram.mappings.title')}</h3>
          <p className="mt-0.5 text-xs text-gf-text-muted">{t('settings.telegram.mappings.subtitle')}</p>
        </div>

        {loadingData ? (
          <p className="px-5 py-8 text-xs text-gf-text-muted">[{t('common.loading')}]</p>
        ) : groups.length === 0 ? (
          <p className="px-5 py-8 text-xs text-gf-text-muted">{t('settings.telegram.mappings.noGroups')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gf-border text-left">
                  <th className="px-5 py-2.5 font-mono font-normal text-gf-text-muted">
                    {t('settings.telegram.mappings.eventLabel')}
                  </th>
                  {groups.map((g) => (
                    <th
                      key={g.id}
                      className="px-3 py-2.5 text-center font-mono font-normal text-gf-text-muted"
                    >
                      <span
                        className={`block max-w-[110px] truncate ${
                          g.is_active ? 'text-gf-text' : 'text-gf-text-placeholder line-through'
                        }`}
                        title={g.name}
                      >
                        {g.name}
                      </span>
                      <span className="mt-0.5 block text-gf-text-placeholder">
                        {t(`settings.telegram.groups.purposes.${g.purpose}`)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TELEGRAM_EVENT_TYPES.map((eventType) => (
                  <tr key={eventType} className="border-b border-gf-border last:border-0">
                    <td className="px-5 py-3 text-gf-text">
                      {t(`settings.telegram.mappings.events.${eventType}`)}
                    </td>
                    {groups.map((g) => {
                      const key = `${eventType}:${g.id}`
                      const active = mappings.some(
                        (m) =>
                          m.event_type === eventType &&
                          m.telegram_group_id === g.id &&
                          m.is_active,
                      )
                      return (
                        <td key={g.id} className="px-3 py-3 text-center">
                          <button
                            onClick={() => handleToggleMapping(eventType, g.id)}
                            disabled={togglingKey === key || !g.is_active}
                            className={`transition-colors duration-150 disabled:opacity-40 ${
                              active ? 'text-gf-primary' : 'text-gf-border hover:text-gf-text-muted'
                            }`}
                            title={g.name}
                          >
                            {active ? (
                              <CheckSquare size={16} strokeWidth={1.5} />
                            ) : (
                              <Square size={16} strokeWidth={1.5} />
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
