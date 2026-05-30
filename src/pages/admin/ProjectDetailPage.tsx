import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Pencil, Play, Trash2 } from 'lucide-react'
import {
  deactivateProject,
  getProject,
  getProjectMetrics,
  listProjectWorkOrders,
  reactivateProject,
  type Project,
  type ProjectMetrics,
  type ProjectWorkOrderRow,
} from '@/services/projectService'
import { fetchClients } from '@/services/workOrderService'
import { ProjectFormModal, type ProjectClientRef } from '@/components/admin/ProjectFormModal'
import { T } from '@/components/T'

const STATUS_LABEL: Record<string, string> = {
  created: 'Erstellt',
  assigned: 'Zugewiesen',
  in_progress: 'In Arbeit',
  executed: 'Ausgeführt',
  rueckmeldung_pending: 'Rückmeldung offen',
  rueckmeldung_sent: 'Rückmeldung gesendet',
  internally_certified: 'Intern zertifiziert',
  sent_to_client: 'An Kunden',
  client_accepted: 'Vom Kunden angenommen',
  invoiced: 'Fakturiert',
  paid: 'Bezahlt',
  cancelled: 'Storniert',
}

const TEAM_DOT: Record<string, string> = {
  rot: 'bg-team-rot',
  gruen: 'bg-team-gruen',
  blau: 'bg-team-blau',
  gelb: 'bg-team-gelb',
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null)
  const [workOrders, setWorkOrders] = useState<ProjectWorkOrderRow[]>([])
  const [clients, setClients] = useState<ProjectClientRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    const [projectRes, metricsRes, woRes, clientsRes] = await Promise.all([
      getProject(id),
      getProjectMetrics(id),
      listProjectWorkOrders(id),
      fetchClients(),
    ])
    if (projectRes.error) setError(projectRes.error)
    setProject(projectRes.data)
    setMetrics(metricsRes.data)
    setWorkOrders(woRes.data)
    setClients(clientsRes.data as ProjectClientRef[])
    setLoading(false)
  }, [id])

  useEffect(() => {
    // Data fetch on mount / when the project id changes. load() sets a loading
    // flag before awaiting the DB — a legitimate effect (syncing with an external
    // system), not the cascading render set-state-in-effect targets. Long-term
    // fix: move these loaders to a data-fetching library (React Query/SWR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const handleDeactivate = async () => {
    if (!project) return
    if (!window.confirm(`Projekt "${project.code}" deaktivieren?`)) return
    const { error: err } = await deactivateProject(project.id)
    if (err) {
      setError(err)
      return
    }
    await load()
  }

  const handleReactivate = async () => {
    if (!project) return
    const { error: err } = await reactivateProject(project.id)
    if (err) {
      setError(err)
      return
    }
    await load()
  }

  if (loading) return <p className="p-6 m">Lädt…</p>
  if (error || !project) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-err">{error ?? 'Projekt nicht gefunden.'}</p>
        <button onClick={() => navigate('/admin/projects')} className="btn btn-g btn-sm">
          <ArrowLeft size={14} strokeWidth={1.5} />
          Zurück
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <button
          onClick={() => navigate('/admin/projects')}
          className="text-xs text-fg-3 hover:text-fg-1 transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} strokeWidth={1.5} />
          Alle <T de="Projekte" />
        </button>
        <div className="phead mt-2">
          <div>
            <h1 className="title font-mono">{project.code}</h1>
            <p className="m mt-1">{project.name}</p>
            <p className="m mt-0.5 text-xs">
              {project.clients ? (
                <>{project.clients.code} — {project.clients.name}</>
              ) : (
                <>Direkt / kein <T de="Kunde" /></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)} className="btn btn-g btn-sm">
              <Pencil size={14} strokeWidth={1.5} />
              <T de="Bearbeiten" />
            </button>
            {project.is_active ? (
              <button onClick={handleDeactivate} className="btn btn-g btn-sm">
                <Trash2 size={14} strokeWidth={1.5} />
                <T de="Deaktivieren" />
              </button>
            ) : (
              <button onClick={handleReactivate} className="btn btn-p btn-sm">
                <Play size={14} strokeWidth={1.5} />
                <T de="Reaktivieren" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <MetricCard label={<T de="Gesamt" />} value={metrics?.total ?? 0} />
        <MetricCard label={<T de="Aktiv" />} value={metrics?.active ?? 0} tone="accent" />
        <MetricCard label={<T de="Abgeschlossen" />} value={metrics?.completed ?? 0} tone="ok" />
        <MetricCard label={<T de="Storniert" />} value={metrics?.cancelled ?? 0} tone="muted" />
      </div>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-wider text-fg-3 mb-3">
          <T de="Aufträge" /> ({workOrders.length})
        </h2>
        {workOrders.length === 0 ? (
          <p className="m">Noch keine Aufträge in diesem Projekt.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="t">
              <thead>
                <tr>
                  <th>Nummer</th>
                  <th>Status</th>
                  <th>Team</th>
                  <th>Kunde</th>
                  <th>Erstellt</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => (
                  <tr key={wo.id}>
                    <td>
                      <Link
                        to={`/admin/orders/${wo.id}`}
                        className="font-mono text-accent hover:underline"
                      >
                        {wo.order_number ?? wo.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="text-fg-2">{STATUS_LABEL[wo.status] ?? wo.status}</td>
                    <td>
                      {wo.assigned_team ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className={`h-1.5 w-1.5 rounded-full ${TEAM_DOT[wo.assigned_team] ?? 'bg-fg-3'}`} />
                          {wo.assigned_team}
                        </span>
                      ) : (
                        <span className="text-fg-3">—</span>
                      )}
                    </td>
                    <td className="text-fg-2">{wo.clients?.name ?? '—'}</td>
                    <td className="text-fg-3 text-xs">
                      {new Date(wo.created_at).toLocaleDateString('de-DE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <ProjectFormModal
          project={project}
          clients={clients}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            load()
          }}
        />
      )}
    </div>
  )
}

interface MetricCardProps {
  label: ReactNode
  value: number
  tone?: 'accent' | 'ok' | 'muted'
}

function MetricCard({ label, value, tone }: MetricCardProps) {
  const valueClass =
    tone === 'accent'
      ? 'text-accent'
      : tone === 'ok'
      ? 'text-ok'
      : tone === 'muted'
      ? 'text-fg-3'
      : 'text-fg-1'
  return (
    <div className="border border-line bg-bg-1 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-fg-3">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  )
}
