import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ClipboardList, RefreshCw } from 'lucide-react'
import {
  fetchWorkOrders,
  fetchClients,
  fetchProjects,
  deleteWorkOrder,
  type WorkOrderFilters,
  type WorkOrderWithRelations,
} from '@/services/workOrderService'
import type { WorkOrderStatus, WorkType, TeamColor } from '@/types/enums'
import { useLabels, STATUS_GROUPS } from '@/i18n/labels'
import { useTranslation } from 'react-i18next'
import { STATUS_COLORS, TEAM_DOT, PRIORITY_COLORS } from '@/constants/styles'
import { useAuth } from '@/hooks/useAuth'
import { Can } from '@/components/ui/Can'
import { notifyOrderDeleted } from '@/services/notificationService'

const PAGE_SIZE = 25

export function WorkOrdersPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const L = useLabels()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [orders, setOrders] = useState<WorkOrderWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [clients, setClients] = useState<{ id: string; name: string; code: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string; code: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [filters, setFilters] = useState<WorkOrderFilters>(() => {
    const group = searchParams.get('statusGroup') as keyof typeof STATUS_GROUPS | null
    if (group && STATUS_GROUPS[group]) {
      return { statuses: [...STATUS_GROUPS[group]] }
    }
    return {}
  })
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
      try {
        const activeFilters: WorkOrderFilters = { ...filters }
        if (debouncedSearch.trim()) activeFilters.search = debouncedSearch.trim()
        const { data, total, error } = await fetchWorkOrders(activeFilters, page, PAGE_SIZE)
        if (cancelled) return
        if (error) setError(error)
        else { setOrders(data); setTotal(total) }
      } catch {
        if (!cancelled) setError('Verbindungsfehler. Bitte erneut versuchen.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [filters, debouncedSearch, page])

  useEffect(() => {
    fetchClients().then(({ data }) => setClients(data))
    fetchProjects().then(({ data }) => setProjects(data))
  }, [])

  async function handleDelete(id: string) {
    const order = orders.find((o) => o.id === id)
    const { error } = await deleteWorkOrder(id)
    if (error) {
      setError(error)
    } else {
      setOrders((prev) => prev.filter((o) => o.id !== id))
      if (order?.order_number) {
        void notifyOrderDeleted({
          orderNumber: order.order_number,
          teamName: order.assigned_team ? t(`teamColor.${order.assigned_team}`) : undefined,
          technicianName: order.assignedProfile?.full_name ?? undefined,
          workType: order.work_type ? t(`workType.${order.work_type}`) : undefined,
          address: order.address ?? undefined,
          adminName: user?.email ?? undefined,
        })
      }
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
        <Can permission="work_orders.create">
          <button
            onClick={() => navigate('/admin/orders/new')}
            className="btn btn-p"
          >
            <span className="text-base leading-none">+</span> {t('workOrder.newOrder')}
          </button>
        </Can>
      </div>

      {/* Filters */}
      <div className="panel mb-4">
        <div className="pbody space-y-3">
        {/* Row 1 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Search */}
          <div className="relative col-span-2 sm:col-span-1">
            <input
              type="text"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => { setPage(0); setSearch(e.target.value) }}
              className="w-full rounded-s border border-line-s bg-bg-0 px-3 py-2 pr-8 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {(search !== debouncedSearch || (isLoading && debouncedSearch !== '')) && (
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                <span className="nx-loader-sm block h-3.5 w-3.5" />
              </span>
            )}
          </div>

          {/* Status filter */}
          <select
            value={filters.statuses ? `group:${Object.entries(STATUS_GROUPS).find(([, v]) => JSON.stringify(v) === JSON.stringify(filters.statuses))?.[0] ?? ''}` : filters.status ?? ''}
            onChange={(e) => {
              setPage(0)
              const val = e.target.value
              if (val.startsWith('group:')) {
                const groupKey = val.replace('group:', '') as keyof typeof STATUS_GROUPS
                const statuses = STATUS_GROUPS[groupKey]
                setFilters((f) => ({ ...f, status: undefined, statuses: statuses ? [...statuses] : undefined }))
              } else {
                setFilters((f) => ({ ...f, statuses: undefined, status: (val as WorkOrderStatus) || undefined }))
              }
            }}
            className="rounded-s border border-line-s bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">{t('workOrder.allStatuses')}</option>
            <optgroup label={t('workOrder.statusGroups')}>
              {L.statusGroupOptions().map(({ value, label }) => (
                <option key={`group:${value}`} value={`group:${value}`}>{label}</option>
              ))}
            </optgroup>
            <optgroup label={t('workOrder.individualStatuses')}>
              {L.statusOptions().map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </optgroup>
          </select>

          {/* Team filter */}
          <select
            value={filters.team ?? ''}
            onChange={(e) => {
              setPage(0)
              setFilters((f) => ({ ...f, team: (e.target.value as TeamColor) || undefined }))
            }}
            className="rounded-s border border-line-s bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">{t('workOrder.allTeams')}</option>
            {L.teamOptions().map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {/* Work type filter */}
          <select
            value={filters.work_type ?? ''}
            onChange={(e) => {
              setPage(0)
              setFilters((f) => ({ ...f, work_type: (e.target.value as WorkType) || undefined }))
            }}
            className="rounded-s border border-line-s bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
            className="rounded-s border border-line-s bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
            className="rounded-s border border-line-s bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
            className="rounded-s border border-line-s bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
            className="rounded-s border border-line-s bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            title={t('workOrder.dateFrom')}
          />

          {/* Date to */}
          <input
            type="date"
            value={filters.date_to ?? ''}
            onChange={(e) => {
              setPage(0)
              setFilters((f) => ({ ...f, date_to: e.target.value || undefined }))
            }}
            className="rounded-s border border-line-s bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            title={t('workOrder.dateTo')}
          />

          {/* Reset */}
          <button
            onClick={() => { setPage(0); setFilters({}); setSearch('') }}
            className="btn btn-g"
          >
            {t('workOrder.resetFilters')}
          </button>
        </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="notice notice-err mb-4 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            onClick={() => { setError(null); setPage(0) }}
            aria-label="Erneut versuchen"
            className="btn btn-danger btn-sm shrink-0"
          >
            <RefreshCw size={12} strokeWidth={1.5} aria-hidden="true" />
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="panel">
        {isLoading ? (
          <div className="flex items-center justify-center py-16" role="status" aria-label={t('common.loading')}>
            <div className="nx-loader" aria-hidden="true" />
          </div>
        ) : orders.length === 0 ? (
          <div className="nx-empty border-0">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-line bg-bg-0">
              <ClipboardList size={18} strokeWidth={1.5} className="text-fg-3" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-fg-1">{t('workOrder.empty')}</p>
            <p className="mt-1 text-xs text-fg-3">
              {Object.keys(filters).length > 0 || debouncedSearch
                ? t('workOrder.emptyFiltered')
                : t('workOrder.emptyFirst')}
            </p>
            {Object.keys(filters).length === 0 && !debouncedSearch && (
              <button
                onClick={() => navigate('/admin/orders/new')}
                className="btn btn-g mt-2"
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
                  <th scope="col" className="nx-label px-4 py-3 text-left">{t('workOrder.colOrderNumber')}</th>
                  <th scope="col" className="nx-label px-4 py-3 text-left">{t('workOrder.colType')}</th>
                  <th scope="col" className="nx-label px-4 py-3 text-left">{t('workOrder.colClientProject')}</th>
                  <th scope="col" className="nx-label px-4 py-3 text-left hidden sm:table-cell">{t('workOrder.team')}</th>
                  <th scope="col" className="nx-label px-4 py-3 text-left hidden md:table-cell">{t('workOrder.priority')}</th>
                  <th scope="col" className="nx-label px-4 py-3 text-left">{t('workOrder.colStatus')}</th>
                  <th scope="col" className="nx-label px-4 py-3 text-left hidden lg:table-cell">{t('common.date')}</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">{t('common.actions')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-bg-0/50 transition-colors ${order.status === 'rueckmeldung_sent' ? 'bg-warn/10' : ''}`}
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
                      <span className={`badge ${PRIORITY_COLORS[order.priority]}`}>
                        {L.priority(order.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge badge-dot ${STATUS_COLORS[order.status]}`}>
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
                          aria-label={`${t('workOrder.colOrderNumber')} ${order.order_number}`}
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
                            t('common.details')
                          )}
                        </button>
                        {(order.status === 'created' || order.status === 'assigned') && (
                          <Can permission="work_orders.assign">
                            <button
                              onClick={() => navigate(`/admin/orders/${order.id}/assign`)}
                              aria-label={`${t('workOrder.actionAssign')} ${order.order_number}`}
                              className="rounded px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                            >
                              {order.status === 'assigned' ? t('workOrder.actionReassign') : t('workOrder.actionAssign')}
                            </button>
                          </Can>
                        )}
                        <Can permission="work_orders.edit">
                          <button
                            onClick={() => navigate(`/admin/orders/${order.id}/edit`)}
                            aria-label={`${t('workOrder.actionEdit')} ${order.order_number}`}
                            className="rounded px-2.5 py-1.5 text-xs font-medium text-fg-2 hover:bg-bg-0 hover:text-fg-1 transition-colors"
                          >
                            {t('workOrder.actionEdit')}
                          </button>
                        </Can>
                        <Can permission="work_orders.delete">
                          <button
                            onClick={() => setDeleteId(order.id)}
                            aria-label={`${t('common.delete')} ${order.order_number}`}
                            className="rounded px-2.5 py-1.5 text-xs font-medium text-fg-2 hover:bg-err/10 hover:text-err transition-colors"
                          >
                            {t('common.delete')}
                          </button>
                        </Can>
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
            {t('workOrder.paginationRange', { from: page * PAGE_SIZE + 1, to: Math.min((page + 1) * PAGE_SIZE, total), total })}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-s border border-line px-3 py-1.5 text-xs text-fg-1 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('workOrder.prevPage')}
            </button>
            <button
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-s border border-line px-3 py-1.5 text-xs text-fg-1 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('workOrder.nextPage')}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div
          className="modal-scrim centered"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-order-title"
        >
          <div className="modal-card compact p-6">
            <h3 id="delete-order-title" className="mb-2 font-display text-base font-semibold text-fg-1">
              {t('workOrder.deleteTitle')}
            </h3>
            <p className="mb-5 text-sm text-fg-2">
              {t('workOrder.deleteWarning')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="btn btn-g flex-1"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="btn btn-danger flex-1"
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
