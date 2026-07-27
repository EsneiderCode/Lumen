import { Suspense, lazy, useState } from 'react'
import { MapPin, Save, X } from 'lucide-react'
import {
  createProject,
  updateProject,
  type Project,
  type ProjectInput,
} from '@/services/projectService'
import { T } from '@/components/T'

const NexusMap = lazy(() => import('@/components/map/NexusMap'))

/** Where the pin starts when the project has no centre yet. */
const GERMANY_CENTER = { lat: 51.1657, lng: 10.4515 }

const EMPTY_FORM: ProjectInput = {
  code: '',
  name: '',
  client_id: null,
  default_operator_id: null,
  default_line: null,
  city: null,
  center_lat: null,
  center_lng: null,
}

export interface ProjectClientRef {
  id: string
  code: string
  name: string
}

export interface ProjectOperatorRef {
  id: string
  code: string
  name: string
}

interface Props {
  project: Project | null
  clients: ProjectClientRef[]
  operators?: ProjectOperatorRef[]
  onClose: () => void
  onSaved: (saved: Project) => void
}

export function ProjectFormModal({ project, clients, operators = [], onClose, onSaved }: Props) {
  const isEdit = !!project
  const [form, setForm] = useState<ProjectInput>(
    project
      ? {
          code: project.code,
          name: project.name,
          client_id: project.client_id,
          default_operator_id: project.default_operator_id,
          default_line: project.default_line,
          city: project.city,
          center_lat: project.center_lat,
          center_lng: project.center_lng,
        }
      : EMPTY_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(false)

  const center =
    typeof form.center_lat === 'number' && typeof form.center_lng === 'number'
      ? { lat: form.center_lat, lng: form.center_lng }
      : null

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

          {operators.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="input">
                <label><T de="Standard-Operator" /></label>
                <select
                  value={form.default_operator_id ?? ''}
                  onChange={(e) => set('default_operator_id', e.target.value || null)}
                >
                  <option value="">— kein Standard —</option>
                  {operators.map((operator) => (
                    <option key={operator.id} value={operator.id}>
                      {operator.code} — {operator.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input">
                <label><T de="Standard-Linie" /></label>
                <select
                  value={form.default_line ?? ''}
                  onChange={(e) => set('default_line', (e.target.value || null) as ProjectInput['default_line'])}
                >
                  <option value="">— kein Standard —</option>
                  <option value="NE3">NE3</option>
                  <option value="NE4">NE4</option>
                </select>
              </div>
            </div>
          )}

          {/* Locality and map centre. A project always happens in the same
              town, so this is set once here instead of by every technician on
              every trench: it is where their map opens when a photo brought no
              coordinates of its own. */}
          <div className="grid grid-cols-2 gap-4">
            <div className="input">
              <label><T de="Ort" /></label>
              <input
                value={form.city ?? ''}
                onChange={(e) => set('city', e.target.value || null)}
                placeholder="z. B. Roßdorf"
                maxLength={120}
              />
            </div>
            <div className="input">
              <label><T de="Kartenmittelpunkt" /></label>
              <button
                type="button"
                onClick={() => setMapOpen((open) => !open)}
                aria-expanded={mapOpen}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-m border border-line px-3 py-2 font-mono text-xs text-fg-1 transition-colors duration-200 hover:border-accent hover:text-accent"
              >
                <MapPin size={14} strokeWidth={1.5} />
                {center
                  ? `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`
                  : <T de="Nicht gesetzt" />}
              </button>
            </div>
          </div>

          {mapOpen && (
            <div className="space-y-2">
              <Suspense
                fallback={
                  <div className="flex h-56 items-center justify-center rounded-l border border-line bg-bg-0 font-mono text-[11px] text-fg-3">
                    [LOADING]
                  </div>
                }
              >
                <NexusMap
                  heightClass="h-56"
                  draggable={center ?? GERMANY_CENTER}
                  onDragEnd={(position) => {
                    set('center_lat', position.lat)
                    set('center_lng', position.lng)
                  }}
                />
              </Suspense>
              <p className="text-xs text-fg-3">
                <T de="Ziehe den Pin in die Ortsmitte. Dort öffnet sich die Karte des Technikers." />
              </p>
              {center && (
                <button
                  type="button"
                  onClick={() => {
                    set('center_lat', null)
                    set('center_lng', null)
                  }}
                  className="text-xs text-fg-3 underline underline-offset-2 hover:text-accent"
                >
                  <T de="Mittelpunkt entfernen" />
                </button>
              )}
            </div>
          )}

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
