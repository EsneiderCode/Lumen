import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowRight,
  Check,
  Clock3,
  Download,
  Euro,
  FileSpreadsheet,
  Filter,
  Receipt,
  Send,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import ExcelJS from 'exceljs'
import { buildDatevCsv, downloadDatevCsv } from '@/services/datevExportService'
import {
  fetchWorkOrders,
  bulkWorkOrderAction,
  generateDataHash,
  fetchProjects,
  fetchTechnicians,
  fetchBillingLines,
  getCollaboratorType,
  type WorkOrderWithRelations,
  type CollaboratorType,
  type BulkWorkOrderAction,
  type BulkWorkOrderResult,
} from '@/services/workOrderService'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { WorkOrderStatus, TeamColor, UserRole } from '@/types/enums'
import { useTranslation } from 'react-i18next'
import { useLabels } from '@/i18n/labels'
import { TEAM_DOT } from '@/constants/styles'
import { Alert, Badge, Button, EmptyState, KPI, KPIGrid, Panel } from '@/components/ui/nexus'
import { Can } from '@/components/ui/Can'

interface Project {
  id: string
  name: string
  code: string
}

const CERT_STATUSES: WorkOrderStatus[] = [
  'rueckmeldung_sent',
  'internally_certified',
  'sent_to_client',
  'client_accepted',
  'client_rejected',
  'invoiced',
]

const SECTION_KEYS: {
  status: WorkOrderStatus
  labelKey: string
  descKey: string
  bulkAction?: string
}[] = [
  {
    status: 'rueckmeldung_sent',
    labelKey: 'certPage.stageRueckmeldungSent',
    descKey: 'certPage.stageRueckmeldungSentDesc',
    bulkAction: 'certify',
  },
  {
    status: 'internally_certified',
    labelKey: 'certPage.stageInternallyCertified',
    descKey: 'certPage.stageInternallyCertifiedDesc',
    bulkAction: 'send_to_client',
  },
  { status: 'sent_to_client', labelKey: 'certPage.stageSentToClient', descKey: 'certPage.stageSentToClientDesc' },
  { status: 'client_rejected', labelKey: 'certPage.stageClientRejected', descKey: 'certPage.stageClientRejectedDesc' },
  {
    status: 'client_accepted',
    labelKey: 'certPage.stageClientAccepted',
    descKey: 'certPage.stageClientAcceptedDesc',
    bulkAction: 'invoice',
  },
  { status: 'invoiced', labelKey: 'certPage.stageInvoiced', descKey: 'certPage.stageInvoicedDesc' },
]

const SECTION_TONE: Partial<
  Record<WorkOrderStatus, 'neutral' | 'info' | 'ok' | 'warn' | 'err' | 'accent'>
> = {
  rueckmeldung_sent: 'warn',
  internally_certified: 'ok',
  sent_to_client: 'info',
  client_rejected: 'err',
  client_accepted: 'accent',
  invoiced: 'neutral',
}

interface BulkInvoiceModal {
  open: boolean
  invoiceNumber: string
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function CertificationPage() {
  const { t } = useTranslation()
  const L = useLabels()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [orders, setOrders] = useState<WorkOrderWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isBulkWorking, setIsBulkWorking] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkWorkOrderResult | null>(null)

  // Filters
  const [filterTeam, setFilterTeam] = useState<TeamColor | ''>('')
  const [filterProject, setFilterProject] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterCollab, setFilterCollab] = useState<'' | CollaboratorType>('')
  const [projects, setProjects] = useState<Project[]>([])

  // Profiles map (id → role) — drives internal vs external classification
  // Plus per-order billing-line totals derived from work_order_billing_lines
  const [profileRoles, setProfileRoles] = useState<Record<string, UserRole>>({})
  const [orderTotals, setOrderTotals] = useState<
    Record<string, { client: number; external: number }>
  >({})

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Bulk invoice modal
  const [bulkInvoiceModal, setBulkInvoiceModal] = useState<BulkInvoiceModal>({
    open: false,
    invoiceNumber: '',
  })

  // refreshKey increments to re-trigger the load effect after bulk actions
  const [refreshKey, setRefreshKey] = useState(0)

  // Active tab — one status visible at a time (NEXUS.OS tabs pattern)
  const [activeTab, setActiveTab] = useState<WorkOrderStatus>('rueckmeldung_sent')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const filters = {
        team: filterTeam || undefined,
        project_id: filterProject || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
      }
      const results = await Promise.all(
        CERT_STATUSES.map((s) => fetchWorkOrders({ ...filters, status: s })),
      )
      if (cancelled) return
      const all = results.flatMap((r) => r.data)
      setOrders(all)
      setSelected(new Set())

      // Load billing-line totals per order so we can show client/external amounts
      // in the row. work_order_billing_lines.subtotal is GENERATED in DB, so
      // summing `qty * unit_price_snapshot` here mirrors the DB result.
      const totals: Record<string, { client: number; external: number }> = {}
      await Promise.all(
        all.map(async (o) => {
          const { data: lines } = await fetchBillingLines(o.id)
          let client = 0
          let external = 0
          for (const l of lines) {
            client += Number(l.qty) * Number(l.unit_price_snapshot)
            if (l.unit_price_external_snapshot != null) {
              external += Number(l.qty) * Number(l.unit_price_external_snapshot)
            }
          }
          totals[o.id] = { client, external }
        }),
      )
      if (cancelled) return
      setOrderTotals(totals)
      setIsLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [filterTeam, filterProject, filterDateFrom, filterDateTo, refreshKey])

  useEffect(() => {
    fetchProjects().then(({ data }) => setProjects(data as Project[]))
    // Build profile-role map: includes technicians (via fetchTechnicians) plus
    // contractors (separate query, because fetchTechnicians filters role).
    void (async () => {
      const [{ data: techs }, contractorRes] = await Promise.all([
        fetchTechnicians(),
        supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('role', 'contractor')
          .eq('is_active', true),
      ])
      const map: Record<string, UserRole> = {}
      for (const t of (techs ?? []) as Array<{ id: string }>) map[t.id] = 'technician'
      for (const c of (contractorRes.data ?? []) as Array<{ id: string; role: UserRole }>) {
        map[c.id] = c.role
      }
      setProfileRoles(map)
    })()
  }, [])

  function orderCollabType(order: WorkOrderWithRelations): CollaboratorType {
    if (!order.assigned_technician) return 'internal'
    return getCollaboratorType(profileRoles[order.assigned_technician])
  }

  const byStatus = (status: WorkOrderStatus) =>
    orders.filter((o) => {
      if (o.status !== status) return false
      if (filterCollab && orderCollabType(o) !== filterCollab) return false
      return true
    })

  function fmtMoney(n: number): string {
    return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSection(status: WorkOrderStatus) {
    const ids = byStatus(status).map((o) => o.id)
    const allSelected = ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }

  async function runBulkAction(args: {
    action: BulkWorkOrderAction
    ids: string[]
    notes: string
    dataHash?: string
    billingReference?: string | null
  }) {
    if (!user) return
    const workOrders = orders
      .filter((order) => args.ids.includes(order.id))
      .map((order) => ({ id: order.id, orderNumber: order.order_number }))
    setIsBulkWorking(true)
    setBulkResult(null)
    const result = await bulkWorkOrderAction({
      action: args.action,
      workOrders,
      changedBy: user.id,
      dataHash: args.dataHash,
      billingReference: args.billingReference ?? null,
      notes: args.notes,
    })
    setBulkResult(result)
    setIsBulkWorking(false)
    setRefreshKey((k) => k + 1)
  }

  async function handleBulkCertify() {
    const ids = orders
      .filter((o) => o.status === 'rueckmeldung_sent' && selected.has(o.id))
      .map((o) => o.id)
    if (!ids.length) return
    const dataHash = await generateDataHash({
      action: 'bulk_internal_certify',
      ids,
      certified_by: user?.id,
      certified_at: new Date().toISOString(),
    })
    await runBulkAction({
      action: 'internal_certify',
      ids,
      dataHash,
      notes: 'Bulk intern zertifiziert durch Admin',
    })
  }

  async function handleBulkSendToClient() {
    const ids = orders
      .filter((o) => o.status === 'internally_certified' && selected.has(o.id))
      .map((o) => o.id)
    if (!ids.length) return
    await runBulkAction({ action: 'send_to_client', ids, notes: 'Bulk an Kunden gesendet' })
  }

  async function handleBulkInvoice() {
    const invoiceNum = bulkInvoiceModal.invoiceNumber.trim()
    if (!invoiceNum) return
    const ids = orders
      .filter((o) => o.status === 'client_accepted' && selected.has(o.id))
      .map((o) => o.id)
    if (!ids.length) return
    setBulkInvoiceModal({ open: false, invoiceNumber: '' })
    await runBulkAction({
      action: 'invoice',
      ids,
      billingReference: invoiceNum,
      notes: `Rechnung: ${invoiceNum}`,
    })
  }

  /** Builds a DATEV-Buchungsstapel CSV from invoiced orders.
   *  If selection is non-empty, only selected orders ship; otherwise all
   *  invoiced orders in the current view are exported. */
  function handleDatevExport() {
    const candidatePool = selected.size > 0 ? orders.filter((o) => selected.has(o.id)) : orders
    const invoicedOrders = candidatePool.filter((o) => o.status === 'invoiced')
    if (invoicedOrders.length === 0) return

    const inputs = invoicedOrders.map((o) => ({
      order: o,
      totalClient: orderTotals[o.id]?.client ?? 0,
      invoiceDate: o.assigned_date ?? undefined,
      invoiceNumber: null as string | null,
    }))
    const csv = buildDatevCsv(inputs)
    const date = new Date().toISOString().slice(0, 10)
    downloadDatevCsv(csv, `lumen-datev-${date}.csv`)
  }

  async function handleExcelExport() {
    const selectedOrders = selected.size > 0 ? orders.filter((o) => selected.has(o.id)) : orders
    const headers = [
      'Auftragsnummer',
      'Typ',
      'Status',
      'Kunde',
      'Projekt',
      'Team',
      'Einsatzdatum',
      'Priorität',
    ]

    const rows = selectedOrders.map((o): Record<string, string | number> => ({
      Auftragsnummer: o.order_number,
      Typ: L.workType(o.work_type),
      Status: L.status(o.status) || o.status,
      Kunde: o.clients?.name ?? '',
      Projekt: o.projects?.code ?? '',
      Team: o.assigned_team ?? '',
      Einsatzdatum: o.assigned_date ? new Date(o.assigned_date).toLocaleDateString('de-DE') : '',
      Priorität: o.priority,
    }))

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Zertifizierung')
    worksheet.addRow(headers)
    worksheet.addRows(rows.map((row) => headers.map((header) => row[header] ?? '')))
    worksheet.columns = headers.map((header) => ({ width: Math.max(header.length + 2, 14) }))
    worksheet.views = [{ state: 'frozen', ySplit: 1 }]

    await downloadWorkbook(
      workbook,
      `LUMEN_Zertifizierung_${new Date().toISOString().slice(0, 10)}.xlsx`,
    )
  }

  // Derive bulk action availability
  const selectedCertifiable = orders.filter(
    (o) => o.status === 'rueckmeldung_sent' && selected.has(o.id),
  ).length
  const selectedSendable = orders.filter(
    (o) => o.status === 'internally_certified' && selected.has(o.id),
  ).length
  const selectedInvoiceable = orders.filter(
    (o) => o.status === 'client_accepted' && selected.has(o.id),
  ).length
  const hasSelection = selected.size > 0

  const total = orders.length
  const activeSection = SECTION_KEYS.find((s) => s.status === activeTab) ?? SECTION_KEYS[0]
  const activeItems = byStatus(activeTab)
  const allActiveSelected = activeItems.length > 0 && activeItems.every((o) => selected.has(o.id))
  const totalClient = orders.reduce((sum, order) => sum + (orderTotals[order.id]?.client ?? 0), 0)
  const totalExternal = orders.reduce(
    (sum, order) => sum + (orderTotals[order.id]?.external ?? 0),
    0,
  )
  const selectedInvoiced =
    selected.size > 0 &&
    [...selected].some((id) => orders.find((o) => o.id === id)?.status === 'invoiced')
  const datevDisabled = byStatus('invoiced').length === 0 && !selectedInvoiced

  return (
    <div className="space-y-5">
      <div className="ph">
        <div>
          <div className="sub">{t('certPage.subtitle')}</div>
          <h1>
            {t('certPage.title')} <em>{t('certPage.titleEm')}</em>
          </h1>
        </div>
        <div className="r">
          <Can permission="certification.export_datev">
            <Button
              disabled={datevDisabled}
              icon={Download}
              onClick={handleDatevExport}
              title={t('certPage.datevTooltip')}
              variant="ghost"
            >
              DATEV
            </Button>
          </Can>
          <Can permission="certification.export_excel">
            <Button
              disabled={total === 0}
              icon={FileSpreadsheet}
              onClick={handleExcelExport}
              variant="secondary"
            >
              Excel {hasSelection ? `(${selected.size})` : ''}
            </Button>
          </Can>
        </div>
      </div>

      <KPIGrid columns={4}>
        <KPI
          delta={total === 0 ? t('certPage.noActiveLoad') : t('certPage.ordersInScope', { count: total })}
          icon={Workflow}
          label={t('certPage.pipelineLoad')}
          value={total}
        />
        <KPI
          delta={t('certPage.requiresApproval')}
          icon={ShieldCheck}
          label={t('certPage.internalQueue')}
          tone="warn"
          value={byStatus('rueckmeldung_sent').length}
        />
        <KPI
          delta={t('certPage.readyForBilling', { count: byStatus('client_accepted').length })}
          icon={Clock3}
          label={t('certPage.clientAccepted')}
          tone="accent"
          value={byStatus('client_accepted').length}
        />
        <KPI
          delta={t('certPage.externalPayable', { amount: fmtMoney(totalExternal) })}
          icon={Euro}
          label={t('certPage.clientVolume')}
          value={fmtMoney(totalClient)}
        />
      </KPIGrid>

      <div className="nx-cert-console">
        <div className="space-y-4">
          <Panel title={t('certPage.pipeline')} meta={t('certPage.pipelineMeta')} padding="sm">
            <div className="nx-cert-pipeline">
              {SECTION_KEYS.map(({ status, labelKey, descKey }) => {
                const count = byStatus(status).length
                const active = activeTab === status
                return (
                  <button
                    className={['nx-cert-stage', active ? 'nx-cert-stage-active' : '']
                      .filter(Boolean)
                      .join(' ')}
                    key={status}
                    onClick={() => setActiveTab(status)}
                    type="button"
                  >
                    <span className="nx-cert-stage-top">
                      <span className="nx-cert-stage-label">{t(labelKey)}</span>
                      <span className="nx-cert-stage-count">{count}</span>
                    </span>
                    <span className="nx-cert-stage-desc">{t(descKey)}</span>
                  </button>
                )
              })}
            </div>
          </Panel>

          <Panel
            title={
              <span className="inline-flex items-center gap-2">
                <Filter size={14} strokeWidth={1.5} />
                Filter
              </span>
            }
            meta={t('certPage.filterMeta')}
          >
            <div className="nx-filter-grid">
              <div className="input">
                <label>Team</label>
                <select
                  value={filterTeam}
                  onChange={(e) => setFilterTeam(e.target.value as TeamColor | '')}
                >
                  <option value="">{t('certPage.allTeams')}</option>
                  {L.teamOptions().map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="input">
                <label>{t('certPage.project')}</label>
                <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
                  <option value="">{t('certPage.allProjects')}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input">
                <label>{t('certPage.collaborator')}</label>
                <select
                  value={filterCollab}
                  onChange={(e) => setFilterCollab(e.target.value as '' | CollaboratorType)}
                >
                  <option value="">{t('certPage.allCollaborators')}</option>
                  <option value="internal">{t('certPage.internal')}</option>
                  <option value="external">{t('certPage.external')}</option>
                </select>
              </div>

              <div className="input">
                <label>{t('certPage.from')}</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
              </div>

              <div className="input">
                <label>{t('certPage.to')}</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                />
              </div>

              {(filterTeam || filterProject || filterDateFrom || filterDateTo || filterCollab) && (
                <Button
                  onClick={() => {
                    setFilterTeam('')
                    setFilterProject('')
                    setFilterDateFrom('')
                    setFilterDateTo('')
                    setFilterCollab('')
                  }}
                  variant="danger"
                >
                  {t('certPage.clearFilters')}
                </Button>
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          {hasSelection && (
            <Alert
              actions={
                <>
                  {selectedCertifiable > 0 && (
                    <Can permission="certification.certify_internal">
                      <Button
                        disabled={isBulkWorking}
                        icon={Check}
                        loading={isBulkWorking}
                        onClick={() => void handleBulkCertify()}
                        size="sm"
                        variant="secondary"
                      >
                        {t('certPage.certifyInternally', { count: selectedCertifiable })}
                      </Button>
                    </Can>
                  )}
                  {selectedSendable > 0 && (
                    <Can permission="certification.accept_client">
                      <Button
                        disabled={isBulkWorking}
                        icon={Send}
                        loading={isBulkWorking}
                        onClick={() => void handleBulkSendToClient()}
                        size="sm"
                        variant="primary"
                      >
                        {t('certPage.sendToClient', { count: selectedSendable })}
                      </Button>
                    </Can>
                  )}
                  {selectedInvoiceable > 0 && (
                    <Can permission="certification.invoice">
                      <Button
                        disabled={isBulkWorking}
                        icon={Receipt}
                        onClick={() => setBulkInvoiceModal({ open: true, invoiceNumber: '' })}
                        size="sm"
                        variant="secondary"
                      >
                        {t('certPage.invoiceAction', { count: selectedInvoiceable })}
                      </Button>
                    </Can>
                  )}
                  <Button onClick={() => setSelected(new Set())} size="sm" variant="ghost">
                    {t('certPage.clearSelection')}
                  </Button>
                </>
              }
              title={t('certPage.selected', { count: selected.size })}
              tone="info"
            >
              {t('certPage.bulkHint')}
            </Alert>
          )}

          {bulkResult && (
            <Alert
              title={t('certPage.bulkResult', { succeeded: bulkResult.succeeded, failed: bulkResult.failed, skipped: bulkResult.skipped })}
              tone={bulkResult.failed > 0 || bulkResult.skipped > 0 ? 'warn' : 'ok'}
            >
              <div className="mt-2 max-h-40 overflow-auto border border-line">
                {bulkResult.items.map((item) => (
                  <div
                    key={item.workOrderId}
                    className="flex items-start justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0"
                  >
                    <div>
                      <div className="t font-mono text-xs">
                        {item.orderNumber ?? item.workOrderId}
                      </div>
                      {item.reasons.length > 0 && (
                        <div className="m mt-1 text-xs">
                          {item.reasons.map((reason) => reason.message).join('; ')}
                        </div>
                      )}
                    </div>
                    <Badge
                      tone={
                        item.outcome === 'succeeded'
                          ? 'ok'
                          : item.outcome === 'failed'
                            ? 'err'
                            : 'warn'
                      }
                    >
                      {item.outcome}
                    </Badge>
                  </div>
                ))}
              </div>
            </Alert>
          )}

          {isLoading ? (
            <Panel>
              <div className="flex h-56 items-center justify-center">
                <div className="nx-loader" />
              </div>
            </Panel>
          ) : total === 0 ? (
            <EmptyState
              description={t('certPage.emptyDescription')}
              title={t('certPage.emptyTitle')}
            />
          ) : (
            <Panel
              actions={
                activeItems.length > 0 ? (
                  <label className="nx-toggle-wrap">
                    <input
                      checked={allActiveSelected}
                      className="nx-selection-checkbox"
                      onChange={() => toggleSection(activeTab)}
                      type="checkbox"
                    />
                    <span className="nx-toggle-label">{t('certPage.selectLane')}</span>
                  </label>
                ) : null
              }
              meta={`${t('certPage.items', { count: activeItems.length })} · ${fmtMoney(activeItems.reduce((sum, order) => sum + (orderTotals[order.id]?.client ?? 0), 0))}`}
              padding="sm"
              title={
                <span className="inline-flex items-center gap-2">
                  {t(activeSection.labelKey)}
                  <Badge tone={SECTION_TONE[activeTab] ?? 'neutral'}>
                    {L.status(activeTab) || activeTab}
                  </Badge>
                </span>
              }
            >
              {activeItems.length === 0 ? (
                <EmptyState
                  description={t('certPage.emptyLaneDescription')}
                  title={t(activeSection.labelKey)}
                />
              ) : (
                <div className="nx-cert-rows">
                  {activeItems.map((order) => {
                    const collab = orderCollabType(order)
                    const isExternal = collab === 'external'
                    const isDirect = order.client_id == null
                    const totals = orderTotals[order.id] ?? { client: 0, external: 0 }
                    const margin = isExternal ? totals.client - totals.external : 0

                    return (
                      <div className="nx-cert-row" key={order.id}>
                        <input
                          checked={selected.has(order.id)}
                          className="nx-selection-checkbox"
                          onChange={() => toggleOne(order.id)}
                          type="checkbox"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="nx-cert-row-title">{order.order_number}</span>
                            <Badge tone="neutral">{L.workType(order.work_type)}</Badge>
                            {isDirect ? <Badge tone="info">{t('certPage.direct')}</Badge> : null}
                            {isExternal ? <Badge tone="accent">{t('certPage.external')}</Badge> : null}
                          </div>
                          <div className="nx-cert-row-meta">
                            <span>
                              {order.clients?.name ?? (isDirect ? t('certPage.direct') : t('certPage.clientMissing'))}
                            </span>
                            <span>·</span>
                            <span>{order.projects?.code ?? t('certPage.projectMissing')}</span>
                            {order.assigned_team ? (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1.5">
                                  <span
                                    className={`h-2 w-2 rounded-full ${TEAM_DOT[order.assigned_team]}`}
                                  />
                                  {order.assigned_team}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div>
                          <span className="nx-cert-cell-label">{t('certPage.date')}</span>
                          <span className="nx-cert-cell-value">
                            {order.assigned_date
                              ? new Date(order.assigned_date).toLocaleDateString('de-DE')
                              : '—'}
                          </span>
                        </div>

                        <div>
                          <span className="nx-cert-cell-label">{t('certPage.client')}</span>
                          <span className="nx-cert-cell-value">
                            {totals.client > 0 ? fmtMoney(totals.client) : '—'}
                          </span>
                        </div>

                        <div>
                          <span className="nx-cert-cell-label">
                            {isExternal ? t('certPage.extMargin') : t('certPage.internalLabel')}
                          </span>
                          <span className="nx-cert-cell-value">
                            {isExternal && totals.external > 0
                              ? `${fmtMoney(totals.external)} / ${fmtMoney(margin)}`
                              : '—'}
                          </span>
                        </div>

                        <Button
                          iconRight={ArrowRight}
                          onClick={() => navigate(`/admin/orders/${order.id}`)}
                          size="sm"
                          variant="ghost"
                        >
                          {t('certPage.open')}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>

      {bulkInvoiceModal.open && (
        <div
          className="modal-scrim centered"
          onClick={(e) => {
            if (e.target === e.currentTarget)
              setBulkInvoiceModal({ open: false, invoiceNumber: '' })
          }}
        >
          <div className="modal-card compact">
            <div className="phead">
              <div>
                <div className="title">{t('certPage.bulkInvoiceTitle')}</div>
                <div className="m">{t('certPage.bulkInvoiceMeta', { count: selectedInvoiceable })}</div>
              </div>
            </div>
            <div className="pbody space-y-5">
              <div className="input">
                <label>{t('certPage.invoiceNumber')}</label>
                <input
                  autoFocus
                  onChange={(e) =>
                    setBulkInvoiceModal((m) => ({ ...m, invoiceNumber: e.target.value }))
                  }
                  placeholder={t('certPage.invoicePlaceholder')}
                  type="text"
                  value={bulkInvoiceModal.invoiceNumber}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => setBulkInvoiceModal({ open: false, invoiceNumber: '' })}
                  variant="ghost"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  disabled={!bulkInvoiceModal.invoiceNumber.trim() || isBulkWorking}
                  loading={isBulkWorking}
                  onClick={() => void handleBulkInvoice()}
                  variant="primary"
                >
                  {t('certPage.invoiceAction', { count: selectedInvoiceable })}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
