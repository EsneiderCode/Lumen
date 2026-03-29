import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import {
  fetchWorkOrders,
  fetchClients,
  fetchProjects,
  deleteWorkOrder,
  type WorkOrderFilters,
} from '@/services/workOrderService'
import type { WorkOrderStatus, WorkType, TeamColor } from '@/types/enums'
import type { Database } from '@/types/database.types'

type WorkOrderRow = Database['public']['Tables']['work_orders']['Row'] & {
  clients: { name: string; code: string } | null
  projects: { name: string; code: string } | null
  operators: { name: string; code: string } | null
}

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  created: 'Erstellt',
  assigned: 'Zugewiesen',
  in_progress: 'In Bearbeitung',
  executed: 'Ausgeführt',
  rueckmeldung_pending: 'RM ausstehend',
  rueckmeldung_sent: 'RM gesendet',
  internally_certified: 'Int. zertifiziert',
  sent_to_client: 'An Kunden gesendet',
  client_accepted: 'Akzeptiert',
  client_rejected: 'Abgelehnt',
  invoiced: 'Fakturiert',
  paid: 'Bezahlt',
  returned: 'Zurückgegeben',
  cancelled: 'Storniert',
}

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  created: 'bg-gf-text-muted/20 text-gf-text-muted',
  assigned: 'bg-gf-primary/15 text-gf-primary-dark',
  in_progress: 'bg-gf-accent/15 text-gf-accent',
  executed: 'bg-gf-warning/15 text-amber-700',
  rueckmeldung_pending: 'bg-gf-warning/20 text-amber-700',
  rueckmeldung_sent: 'bg-gf-warning/10 text-amber-600',
  internally_certified: 'bg-gf-success/15 text-emerald-700',
  sent_to_client: 'bg-gf-primary/10 text-gf-primary-dark',
  client_accepted: 'bg-gf-success/20 text-emerald-700',
  client_rejected: 'bg-gf-danger/15 text-rose-700',
  invoiced: 'bg-gf-accent/10 text-purple-700',
  paid: 'bg-gf-success/25 text-emerald-800',
  returned: 'bg-gf-warning/15 text-amber-700',
  cancelled: 'bg-gf-danger/10 text-rose-600',
}

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  soplado: 'Soplado',
  fusion_ap: 'Fusión AP',
  fusion_dp: 'Fusión DP',
  alta: 'Alta',
  nt_installation: 'NT-Installation',
  patchkabel: 'Patchkabel',
}

const TEAM_DOT: Record<TeamColor, string> = {
  rot: 'bg-team-rot',
  gruen: 'bg-team-gruen',
  blau: 'bg-team-blau',
  gelb: 'bg-team-gelb',
}

const PRIORITY_LABELS = { normal: 'Normal', alta: 'Hoch', urgente: 'Dringend' }
const PRIORITY_COLORS = {
  normal: 'text-gf-text-muted',
  alta: 'text-gf-warning',
  urgente: 'text-gf-danger',
}

export function WorkOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<WorkOrderRow[]>([])
  const [clients, setClients] = useState<{ id: string; name: string; code: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string; code: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [filters, setFilters] = useState<WorkOrderFilters>({})
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    const activeFilters: WorkOrderFilters = { ...filters }
    if (search.trim()) activeFilters.search = search.trim()
    const { data, error } = await fetchWorkOrders(activeFilters)
    if (error) setError(error)
    else setOrders(data as unknown as WorkOrderRow[])
    setIsLoading(false)
  }, [filters, search])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetchClients().then(({ data }) => setClients(data))
    fetchProjects().then(({ data }) => setProjects(data))
  }, [])

  async function handleDelete(id: string) {
    const { error } = await deleteWorkOrder(id)
    if (error) {
      setError(error)
    } else {
      setOrders((prev) => prev.filter((o) => o.id !== id))
    }
    setDeleteId(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-gf-text">Aufträge</h2>
          <p className="text-sm text-gf-text-muted">{orders.length} Aufträge</p>
        </div>
        <button
          onClick={() => navigate('/admin/orders/new')}
          className="flex items-center gap-2 rounded-lg bg-gf-primary px-4 py-2 text-sm font-semibold text-white hover:bg-gf-primary-dark transition-colors"
        >
          <span className="text-base leading-none">+</span> Neuer Auftrag
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-xl border border-gf-border bg-gf-card p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Search */}
          <input
            type="text"
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="col-span-2 rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary sm:col-span-1"
          />

          {/* Status filter */}
          <select
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                status: (e.target.value as WorkOrderStatus) || undefined,
              }))
            }
            className="rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
          >
            <option value="">Alle Status</option>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          {/* Team filter */}
          <select
            value={filters.team ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, team: (e.target.value as TeamColor) || undefined }))
            }
            className="rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
          >
            <option value="">Alle Teams</option>
            <option value="rot">Rot</option>
            <option value="gruen">Grün</option>
            <option value="blau">Blau</option>
            <option value="gelb">Gelb</option>
          </select>

          {/* Work type filter */}
          <select
            value={filters.work_type ?? ''}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                work_type: (e.target.value as WorkType) || undefined,
              }))
            }
            className="rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
          >
            <option value="">Alle Typen</option>
            {Object.entries(WORK_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          {/* Client filter */}
          <select
            value={filters.client_id ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, client_id: e.target.value || undefined }))
            }
            className="rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
          >
            <option value="">Alle Kunden</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Project filter */}
          <select
            value={filters.project_id ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, project_id: e.target.value || undefined }))
            }
            className="rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
          >
            <option value="">Alle Projekte</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
            ))}
          </select>

          {/* Reset */}
          <button
            onClick={() => { setFilters({}); setSearch('') }}
            className="rounded-lg border border-gf-border px-3 py-2 text-sm text-gf-text-muted hover:border-gf-primary hover:text-gf-primary transition-colors"
          >
            Zurücksetzen
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-gf-danger/30 bg-gf-danger/10 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gf-border bg-gf-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gf-border border-t-gf-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-sm text-gf-text-muted">
            Keine Aufträge gefunden.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gf-border bg-gf-surface">
                  <th className="px-4 py-3 text-left font-semibold text-gf-text-muted">Auftrag #</th>
                  <th className="px-4 py-3 text-left font-semibold text-gf-text-muted">Typ</th>
                  <th className="px-4 py-3 text-left font-semibold text-gf-text-muted">Kunde / Projekt</th>
                  <th className="px-4 py-3 text-left font-semibold text-gf-text-muted">Team</th>
                  <th className="px-4 py-3 text-left font-semibold text-gf-text-muted">Priorität</th>
                  <th className="px-4 py-3 text-left font-semibold text-gf-text-muted">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gf-text-muted">Datum</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gf-border">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-gf-surface/50 transition-colors ${order.status === 'rueckmeldung_sent' ? 'bg-amber-50/60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-gf-primary text-xs">
                        {order.order_number}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gf-text">
                      {WORK_TYPE_LABELS[order.work_type]}
                      <div className="text-xs text-gf-text-muted">{order.line}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gf-text">{order.clients?.code ?? '—'}</div>
                      <div className="text-xs text-gf-text-muted">{order.projects?.code ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {order.assigned_team ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${TEAM_DOT[order.assigned_team]}`} />
                          <span className="capitalize text-gf-text">{order.assigned_team}</span>
                        </div>
                      ) : (
                        <span className="text-gf-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${PRIORITY_COLORS[order.priority]}`}>
                        {PRIORITY_LABELS[order.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gf-text-muted">
                      {new Date(order.created_at).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/admin/orders/${order.id}`)}
                          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                            order.status === 'rueckmeldung_sent'
                              ? 'text-amber-700 hover:bg-amber-50'
                              : 'text-gf-text-muted hover:bg-gf-surface hover:text-gf-text'
                          }`}
                          title="Detail"
                        >
                          {order.status === 'rueckmeldung_sent' ? '📋 RM' : 'Detail'}
                        </button>
                        {(order.status === 'created') && (
                          <button
                            onClick={() => navigate(`/admin/orders/${order.id}/assign`)}
                            className="rounded px-2 py-1 text-xs font-medium text-gf-primary hover:bg-gf-primary/10 transition-colors"
                            title="Zuweisen"
                          >
                            Zuweisen
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/admin/orders/${order.id}/edit`)}
                          className="rounded px-2 py-1 text-xs font-medium text-gf-text-muted hover:bg-gf-surface hover:text-gf-text transition-colors"
                          title="Bearbeiten"
                        >
                          Bearb.
                        </button>
                        <button
                          onClick={() => setDeleteId(order.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-gf-text-muted hover:bg-gf-danger/10 hover:text-gf-danger transition-colors"
                          title="Löschen"
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gf-border bg-gf-card p-6 shadow-xl">
            <h3 className="mb-2 font-display text-base font-semibold text-gf-text">
              Auftrag löschen?
            </h3>
            <p className="mb-5 text-sm text-gf-text-muted">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-lg border border-gf-border px-4 py-2 text-sm font-medium text-gf-text hover:bg-gf-surface transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 rounded-lg bg-gf-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
