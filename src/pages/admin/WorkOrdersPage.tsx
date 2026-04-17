import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  fetchWorkOrders,
  fetchClients,
  fetchProjects,
  deleteWorkOrder,
  type WorkOrderFilters,
  type WorkOrderWithRelations,
} from '@/services/workOrderService'
import type { WorkOrderStatus, WorkType, TeamColor } from '@/types/enums'
import { useLabels } from '@/i18n/labels'
import { STATUS_COLORS, TEAM_DOT, PRIORITY_COLORS } from '@/constants/styles'

const PAGE_SIZE = 25

export function WorkOrdersPage() {
  const L = useLabels()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<WorkOrderWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [clients, setClients] = useState<{ id: string; name: string; code: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string; code: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [filters, setFilters] = useState<WorkOrderFilters>({})
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const activeFilters: WorkOrderFilters = { ...filters }
      if (debouncedSearch.trim()) activeFilters.search = debouncedSearch.trim()
      const { data, total, error } = await fetchWorkOrders(activeFilters, page, PAGE_SIZE)
      if (cancelled) return
      if (error) setError(error)
      else { setOrders(data); setTotal(total) }
      setIsLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [filters, debouncedSearch, page])

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
          <p className="text-sm text-gf-text-muted">{total} Aufträge</p>
        </div>
        <button
          onClick={() => navigate('/admin/orders/new')}
          className="flex items-center gap-2 rounded-gf-btn bg-gf-primary px-4 py-2 text-sm font-semibold text-gf-base hover:bg-gf-primary-dark transition-colors"
        >
          <span className="text-base leading-none">+</span> Neuer Auftrag
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-gf-card border border-gf-border bg-gf-card p-4 space-y-3">
        {/* Row 1 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Search */}
          <div className="relative col-span-2 sm:col-span-1">
            <input
              type="text"
              placeholder="Suchen…"
              value={search}
              onChange={(e) => { setPage(0); setSearch(e.target.value) }}
              className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 pr-8 text-sm text-gf-text placeholder:text-gf-text-placeholder focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
            />
            {(search !== debouncedSearch || (isLoading && debouncedSearch !== '')) && (
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gf-border border-t-gf-primary" />
              </span>
            )}
          </div>

          {/* Status filter */}
          <select
            value={filters.status ?? ''}
            onChange={(e) => {
              setPage(0)
              setFilters((f) => ({ ...f, status: (e.target.value as WorkOrderStatus) || undefined }))
            }}
            className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
          >
            <option value="">Alle Status</option>
            {L.statusOptions().map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {/* Team filter */}
          <select
            value={filters.team ?? ''}
            onChange={(e) => {
              setPage(0)
              setFilters((f) => ({ ...f, team: (e.target.value as TeamColor) || undefined }))
            }}
            className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
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
            onChange={(e) => {
              setPage(0)
              setFilters((f) => ({ ...f, work_type: (e.target.value as WorkType) || undefined }))
            }}
            className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
          >
            <option value="">Alle Typen</option>
            {L.workTypeOptions().map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Client filter */}
          <select
            value={filters.client_id ?? ''}
            onChange={(e) => {
              setPage(0)
              setFilters((f) => ({ ...f, client_id: e.target.value || undefined }))
            }}
            className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
          >
            <option value="">Alle Kunden</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Project filter */}
          <select
            value={filters.project_id ?? ''}
            onChange={(e) => {
              setPage(0)
              setFilters((f) => ({ ...f, project_id: e.target.value || undefined }))
            }}
            className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
          >
            <option value="">Alle Projekte</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={filters.priority ?? ''}
            onChange={(e) => {
              setPage(0)
              setFilters((f) => ({ ...f, priority: (e.target.value as 'normal' | 'alta' | 'urgente') || undefined }))
            }}
            className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
          >
            <option value="">Alle Prioritäten</option>
            {L.priorityOptions().map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {/* Date from */}
          <input
            type="date"
            value={filters.date_from ?? ''}
            onChange={(e) => {
              setPage(0)
              setFilters((f) => ({ ...f, date_from: e.target.value || undefined }))
            }}
            className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
            title="Einsatzdatum von"
          />

          {/* Date to */}
          <input
            type="date"
            value={filters.date_to ?? ''}
            onChange={(e) => {
              setPage(0)
              setFilters((f) => ({ ...f, date_to: e.target.value || undefined }))
            }}
            className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
            title="Einsatzdatum bis"
          />

          {/* Reset */}
          <button
            onClick={() => { setPage(0); setFilters({}); setSearch('') }}
            className="rounded-gf-btn border border-gf-border px-3 py-2 text-sm text-gf-text-muted hover:border-gf-primary hover:text-gf-primary transition-colors"
          >
            Zurücksetzen
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-gf-btn border border-gf-danger/30 bg-gf-danger/10 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-gf-card border border-gf-border bg-gf-card overflow-hidden">
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
                      {L.workType(order.work_type)}
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
                        {L.priority(order.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                        {L.status(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gf-text-muted">
                      {new Date(order.created_at).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/admin/orders/${order.id}`)}
                          className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
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
                            className="rounded px-2.5 py-1.5 text-xs font-medium text-gf-primary hover:bg-gf-primary/10 transition-colors"
                            title="Zuweisen"
                          >
                            Zuweisen
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/admin/orders/${order.id}/edit`)}
                          className="rounded px-2.5 py-1.5 text-xs font-medium text-gf-text-muted hover:bg-gf-surface hover:text-gf-text transition-colors"
                          title="Bearbeiten"
                        >
                          Bearb.
                        </button>
                        <button
                          onClick={() => setDeleteId(order.id)}
                          className="rounded px-2.5 py-1.5 text-xs font-medium text-gf-text-muted hover:bg-gf-danger/10 hover:text-gf-danger transition-colors"
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

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-xs text-gf-text-muted">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} von {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-gf-btn border border-gf-border px-3 py-1.5 text-xs text-gf-text transition-colors hover:border-gf-primary hover:text-gf-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Zurück
            </button>
            <button
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-gf-btn border border-gf-border px-3 py-1.5 text-xs text-gf-text transition-colors hover:border-gf-primary hover:text-gf-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Weiter →
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-gf-card border border-gf-border bg-gf-card p-6 shadow-gf-modal">
            <h3 className="mb-2 font-display text-base font-semibold text-gf-text">
              Auftrag löschen?
            </h3>
            <p className="mb-5 text-sm text-gf-text-muted">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-gf-btn border border-gf-border px-4 py-2 text-sm font-medium text-gf-text hover:bg-gf-surface transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 rounded-gf-btn bg-gf-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
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
