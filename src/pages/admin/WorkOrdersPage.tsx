import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ClipboardList, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      <div className="nx-page-header">
        <div>
          <h2 className="nx-page-title">{t('workOrder.title')}</h2>
          <p className="nx-label mt-2 tabular-nums">{total} total</p>
        </div>
        <button
          onClick={() => navigate('/admin/orders/new')}
          className="flex items-center gap-2 rounded-s bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent transition-colors"
        >
          <span className="text-base leading-none">+</span> {t('workOrder.newOrder')}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-l border border-line bg-bg-1 p-4 space-y-3">
        {/* Row 1 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Search */}
          <div className="relative col-span-2 sm:col-span-1">
            <input
              type="text"
              placeholder={t('workOrder.searchPlaceholder')}
              value={search}
              onChange={(e) => { setPage(0); setSearch(e.target.value) }}
              className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 pr-8 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {(search !== debouncedSearch || (isLoading && debouncedSearch !== '')) && (
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
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
            className="rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">{t('workOrder.allStatus')}</option>
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
            className="rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">{t('workOrder.allTeams')}</option>
            <option value="rot">{t('teamColor.rot')}</option>
            <option value="gruen">{t('teamColor.gruen')}</option>
            <option value="blau">{t('teamColor.blau')}</option>
            <option value="gelb">{t('teamColor.gelb')}</option>
          </select>

          {/* Work type filter */}
          <select
            value={filters.work_type ?? ''}
            onChange={(e) => {
              setPage(0)
              setFilters((f) => ({ ...f, work_type: (e.target.value as WorkType) || undefined }))
            }}
            className="rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">{t('workOrder.allTypes')}</option>
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
            className="rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">{t('workOrder.allClients')}</option>
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
            className="rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">{t('workOrder.allProjects')}</option>
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
            className="rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">{t('workOrder.allPriorities')}</option>
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
            className="rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
            className="rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            title="Einsatzdatum bis"
          />

          {/* Reset */}
          <button
            onClick={() => { setPage(0); setFilters({}); setSearch('') }}
            className="rounded-s border border-line px-3 py-2 text-sm text-fg-2 hover:border-accent hover:text-accent transition-colors"
          >
            {t('common.reset')}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-4 rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          <span>{error}</span>
          <button
            onClick={() => { setError(null); setPage(0) }}
            aria-label={t('common.retry')}
            className="flex shrink-0 items-center gap-1.5 rounded-s border border-err/30 px-2.5 py-1 text-xs text-err hover:bg-err/10 transition-colors"
          >
            <RefreshCw size={12} strokeWidth={1.5} aria-hidden="true" />
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-l border border-line bg-bg-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16" role="status" aria-label="Wird geladen">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-bg-0">
              <ClipboardList size={18} strokeWidth={1.5} className="text-fg-3" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-fg-1">{t('workOrder.noOrdersFound')}</p>
            <p className="mt-1 text-xs text-fg-3">
              {Object.keys(filters).length > 0 || debouncedSearch
                ? t('workOrder.adjustFilters')
                : t('workOrder.createFirst')}
            </p>
            {Object.keys(filters).length === 0 && !debouncedSearch && (
              <button
                onClick={() => navigate('/admin/orders/new')}
                className="mt-4 rounded-s border border-line px-4 py-2 text-xs text-fg-2 hover:border-accent hover:text-accent transition-colors"
              >
                + {t('workOrder.newOrder')}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-bg-2">
                  <th scope="col" className="nx-label px-4 py-3 text-left">{t('workOrder.orderNumber')}</th>
                  <th scope="col" className="nx-label px-4 py-3 text-left">{t('workOrder.workTypeLabel')}</th>
                  <th scope="col" className="nx-label px-4 py-3 text-left">{t('workOrder.customer')} / {t('workOrder.project')}</th>
                  <th scope="col" className="nx-label px-4 py-3 text-left hidden sm:table-cell">{t('workOrder.team')}</th>
                  <th scope="col" className="nx-label px-4 py-3 text-left hidden md:table-cell">{t('workOrder.priority')}</th>
                  <th scope="col" className="nx-label px-4 py-3 text-left">{t('workOrder.statusLabel')}</th>
                  <th scope="col" className="nx-label px-4 py-3 text-left hidden lg:table-cell">{t('workOrder.deploymentDate')}</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">{t('common.actions')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-bg-0/50 transition-colors ${order.status === 'rueckmeldung_sent' ? 'bg-warn/60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-accent text-xs">
                        {order.order_number}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-fg-1">
                      {L.workType(order.work_type)}
                      <div className="text-xs text-fg-2">{order.line}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-fg-1">{order.clients?.code ?? '—'}</div>
                      <div className="text-xs text-fg-2">{order.projects?.code ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {order.assigned_team ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${TEAM_DOT[order.assigned_team]}`} />
                          <span className="capitalize text-fg-1">{order.assigned_team}</span>
                        </div>
                      ) : (
                        <span className="text-fg-2">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs font-medium ${PRIORITY_COLORS[order.priority]}`}>
                        {L.priority(order.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                        {L.status(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-2 hidden lg:table-cell">
                      {new Date(order.created_at).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/admin/orders/${order.id}`)}
                          aria-label={`Auftrag ${order.order_number} öffnen`}
                          className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            order.status === 'rueckmeldung_sent'
                              ? 'text-warn hover:bg-warn/10'
                              : 'text-fg-2 hover:bg-bg-0 hover:text-fg-1'
                          }`}
                        >
                          {order.status === 'rueckmeldung_sent' ? (
                            <span className="inline-flex items-center gap-1">
                              <ClipboardList size={12} strokeWidth={1.5} aria-hidden="true" />
                              RM
                            </span>
                          ) : (
                            t('workOrder.detail')
                          )}
                        </button>
                        {(order.status === 'created') && (
                          <button
                            onClick={() => navigate(`/admin/orders/${order.id}/assign`)}
                            aria-label={`Auftrag ${order.order_number} zuweisen`}
                            className="rounded px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                          >
                            {t('workOrder.assign')}
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/admin/orders/${order.id}/edit`)}
                          aria-label={`Auftrag ${order.order_number} bearbeiten`}
                          className="rounded px-2.5 py-1.5 text-xs font-medium text-fg-2 hover:bg-bg-0 hover:text-fg-1 transition-colors"
                        >
                          {t('workOrder.editShort')}
                        </button>
                        <button
                          onClick={() => setDeleteId(order.id)}
                          aria-label={`Auftrag ${order.order_number} löschen`}
                          className="rounded px-2.5 py-1.5 text-xs font-medium text-fg-2 hover:bg-err/10 hover:text-err transition-colors"
                        >
                          {t('common.delete')}
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
          <span className="font-mono text-xs text-fg-2">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} {t('common.of')} {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-s border border-line px-3 py-1.5 text-xs text-fg-1 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('common.prevPage')}
            </button>
            <button
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-s border border-line px-3 py-1.5 text-xs text-fg-1 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('common.nextPage')}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-order-title"
        >
          <div className="w-full max-w-sm rounded-l border border-line bg-bg-1 p-6">
            <h3 id="delete-order-title" className="mb-2 font-display text-base font-semibold text-fg-1">
              {t('workOrder.deleteTitle')}
            </h3>
            <p className="mb-5 text-sm text-fg-2">
              {t('common.irreversible')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-s border border-line px-4 py-2 text-sm font-medium text-fg-1 hover:bg-bg-0 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 rounded-s bg-err px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
