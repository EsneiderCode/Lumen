import { useState } from 'react'
import { Save, X } from 'lucide-react'
import {
  createProject,
  updateProject,
  type Project,
  type ProjectInput,
} from '@/services/projectService'
import { T } from '@/components/T'

const EMPTY_FORM: ProjectInput = { code: '', name: '', client_id: null }

export interface ProjectClientRef {
  id: string
  code: string
  name: string
}

interface Props {
  project: Project | null
  clients: ProjectClientRef[]
  onClose: () => void
  onSaved: (saved: Project) => void
}

export function ProjectFormModal({ project, clients, onClose, onSaved }: Props) {
  const isEdit = !!project
  const [form, setForm] = useState<ProjectInput>(
    project
      ? { code: project.code, name: project.name, client_id: project.client_id }
      : EMPTY_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    const result = isEdit
      ? await updateProject(project!.id, form)
      : await createProject(form)
    setSaving(false)
    if (result.error || !result.data) {
      setErr(result.error ?? 'Speichern fehlgeschlagen.')
      return
    }
    onSaved(result.data)
  }

  return (
    <div
      className="modal-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-card">
        <div className="phead">
          <div>
            <h3 className="title">
              {isEdit ? (
                <><T de="Projekt" /> <T de="Bearbeiten">bearbeiten</T></>
              ) : (
                <><T de="Neu">Neues</T> <T de="Projekt" /></>
              )}
            </h3>
            <p className="m mt-1">Stammdaten</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-g btn-sm icon-only"
            aria-label="Schließen"
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {err && (
            <div
              role="alert"
              className="border border-err/30 bg-err/10 px-3 py-2 text-sm text-err rounded-s"
            >
              {err}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="input">
              <label>Code *</label>
              <input
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                placeholder="z. B. HXT"
                required
                autoFocus={!isEdit}
                autoComplete="off"
                maxLength={10}
              />
            </div>
            <div className="input col-span-1">
              <label><T de="Kunde" /></label>
              <select
                value={form.client_id ?? ''}
                onChange={(e) => set('client_id', e.target.value || null)}
              >
                <option value="">— Direkt / kein Kunde —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="input">
            <label><T de="Name" /> *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="z. B. Höxter Nord"
              required
              maxLength={120}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-g btn-sm"
              disabled={saving}
            >
              <T de="Abbrechen" />
            </button>
            <button type="submit" className="btn btn-p btn-sm" disabled={saving}>
              <Save size={14} strokeWidth={1.5} />
              {saving ? <><T de="Speichern" />…</> : <T de="Speichern" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
