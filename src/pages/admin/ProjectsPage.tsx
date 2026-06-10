import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Pencil, Play, Plus, Search, Trash2 } from 'lucide-react'
import {
  deactivateProject,
  listProjects,
  reactivateProject,
  type Project,
} from '@/services/projectService'
import { fetchClients, fetchOperators } from '@/services/workOrderService'
import { ProjectFormModal, type ProjectClientRef } from '@/components/admin/ProjectFormModal'
import { T } from '@/components/T'

type ClientRef = ProjectClientRef
interface OperatorRef { id: string; code: string; name: string }

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<ClientRef[]>([])
  const [operators, setOperators] = useState<OperatorRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [projectsRes, clientsRes, operatorsRes] = await Promise.all([
      listProjects({ includeInactive }),
      fetchClients(),
      fetchOperators(),
    ])
    if (projectsRes.error) setError(projectsRes.error)
    setProjects(projectsRes.data)
    setClients(clientsRes.data as ClientRef[])
    setOperators(operatorsRes.data as OperatorRef[])
    setLoading(false)
  }, [includeInactive])

  useEffect(() => {
    // Data fetch on mount / when includeInactive changes. load() sets a loading
    // flag before awaiting the DB — a legitimate effect (syncing with an external
    // system), not the cascading render set-state-in-effect targets. Long-term
    // fix: move these loaders to a data-fetching library (React Query/SWR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    )
  }, [projects, search])

  const handleDeactivate = async (project: Project) => {
    if (!window.confirm(`Projekt "${project.code} – ${project.name}" deaktivieren?`)) return
    const { error } = await deactivateProject(project.id)
    if (error) {
      setError(error)
      return
    }
    await load()
  }

  const handleReactivate = async (project: Project) => {
    const { error } = await reactivateProject(project.id)
    if (error) {
      setError(error)
      return
    }
    await load()
  }

  return (
    <div className="p-6 space-y-5">
      <div className="phead">
        <div>
          <h1 className="title"><T de="Projekte" /></h1>
          <p className="m mt-1">
            {projects.length} {includeInactive ? <T de="Gesamt">gesamt</T> : <T de="Aktiv">aktiv</T>}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-p btn-sm"
          onClick={() => setCreating(true)}
        >
          <Plus size={15} strokeWidth={1.5} />
          <T de="Neu">Neues</T> <T de="Projekt" />
        </button>
      </div>

      {error && (
        <div role="alert" className="border border-err/30 bg-err/10 px-3 py-2 text-sm text-err rounded-s">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="input flex-1 max-w-sm">
          <label className="sr-only">Suche</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Code oder Name suchen…"
              className="pl-9"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-fg-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          <T de="Inaktiv">Inaktive</T> anzeigen
        </label>
      </div>

      {loading ? (
        <p className="m">Lädt…</p>
      ) : filtered.length === 0 ? (
        <p className="m">Keine Projekte gefunden.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="t">
            <thead>
              <tr>
                <th>Code</th>
                <th><T de="Name" /></th>
                <th><T de="Kunde" /></th>
                <th><T de="Status" /></th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className={p.is_active ? '' : 'opacity-60'}>
                  <td>
                    <Link
                      to={`/admin/projects/${p.id}`}
                      className="font-mono text-accent hover:underline"
                    >
                      {p.code}
                    </Link>
                  </td>
                  <td>{p.name}</td>
                  <td className="text-fg-2">{p.clients?.name ?? '—'}</td>
                  <td>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs ${
                        p.is_active ? 'text-ok' : 'text-fg-3'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          p.is_active ? 'bg-ok' : 'bg-fg-3'
                        }`}
                      />
                      {p.is_active ? <T de="Aktiv" /> : <T de="Inaktiv" />}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        className="btn btn-g btn-sm icon-only"
                        aria-label="Bearbeiten"
                        title="Bearbeiten"
                      >
                        <Pencil size={14} strokeWidth={1.5} />
                      </button>
                      {p.is_active ? (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(p)}
                          className="btn btn-g btn-sm icon-only"
                          aria-label="Deaktivieren"
                          title="Deaktivieren"
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReactivate(p)}
                          className="btn btn-g btn-sm icon-only"
                          aria-label="Reaktivieren"
                          title="Reaktivieren"
                        >
                          <Play size={14} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <ProjectFormModal
          project={editing}
          clients={clients}
          operators={operators}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
