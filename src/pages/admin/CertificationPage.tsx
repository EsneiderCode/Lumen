import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import * as XLSX from 'xlsx'
import { fetchWorkOrders, transitionWorkOrderStatus, fetchProjects } from '@/services/workOrderService'
import { useAuth } from '@/hooks/useAuth'
import type { WorkOrderStatus, WorkType, TeamColor } from '@/types/enums'

interface Order {
  id: string
  order_number: string
  work_type: WorkType
  status: WorkOrderStatus
  priority: string
  assigned_team: TeamColor | null
  assigned_date: string | null
  clients: { name: string; code: string } | null
  projects: { name: string; code: string } | null
}

interface Project {
  id: string
  name: string
  code: string
}

const STATUS_LABELS: Record<string, string> = {
  rueckmeldung_sent: 'RM gesendet',
  internally_certified: 'Int. zertifiziert',
  sent_to_client: 'An Kunden gesendet',
  client_accepted: 'Akzeptiert',
  client_rejected: 'Abgelehnt',
  invoiced: 'Fakturiert',
}

const STATUS_COLORS: Record<string, string> = {
  rueckmeldung_sent: 'bg-gf-warning/10 text-amber-600',
  internally_certified: 'bg-gf-success/15 text-emerald-700',
  sent_to_client: 'bg-gf-primary/10 text-gf-primary-dark',
  client_accepted: 'bg-gf-success/20 text-emerald-700',
  client_rejected: 'bg-gf-danger/15 text-rose-700',
  invoiced: 'bg-gf-accent/10 text-purple-700',
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

const CERT_STATUSES: WorkOrderStatus[] = [
  'rueckmeldung_sent',
  'internally_certified',
  'sent_to_client',
  'client_accepted',
  'client_rejected',
  'invoiced',
]

const SECTIONS: { status: WorkOrderStatus; label: string; description: string; bulkAction?: string }[] = [
  { status: 'rueckmeldung_sent', label: 'Rückmeldung eingegangen', description: 'Warten auf interne Zertifizierung', bulkAction: 'certify' },
  { status: 'internally_certified', label: 'Intern zertifiziert', description: 'Bereit zur Weiterleitung an den Kunden', bulkAction: 'send_to_client' },
  { status: 'sent_to_client', label: 'Beim Kunden', description: 'Warten auf Kundenentscheid' },
  { status: 'client_rejected', label: 'Abgelehnt', description: 'Zur Überarbeitung zurückgegeben' },
  { status: 'client_accepted', label: 'Akzeptiert', description: 'Bereit zur Fakturierung', bulkAction: 'invoice' },
  { status: 'invoiced', label: 'Fakturiert', description: 'Warten auf Zahlungseingang' },
]

interface BulkInvoiceModal {
  open: boolean
  invoiceNumber: string
}

export function CertificationPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isBulkWorking, setIsBulkWorking] = useState(false)

  // Filters
  const [filterTeam, setFilterTeam] = useState<TeamColor | ''>('')
  const [filterProject, setFilterProject] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [projects, setProjects] = useState<Project[]>([])

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Bulk invoice modal
  const [bulkInvoiceModal, setBulkInvoiceModal] = useState<BulkInvoiceModal>({ open: false, invoiceNumber: '' })

  // refreshKey increments to re-trigger the load effect after bulk actions
  const [refreshKey, setRefreshKey] = useState(0)

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
      const results = await Promise.all(CERT_STATUSES.map((s) => fetchWorkOrders({ ...filters, status: s })))
      if (cancelled) return
      const all = results.flatMap((r) => (r.data as unknown as Order[]) ?? [])
      setOrders(all)
      setSelected(new Set())
      setIsLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [filterTeam, filterProject, filterDateFrom, filterDateTo, refreshKey])

  useEffect(() => {
    fetchProjects().then(({ data }) => setProjects(data as Project[]))
  }, [])

  const byStatus = (status: WorkOrderStatus) => orders.filter((o) => o.status === status)

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

  async function bulkTransition(ids: string[], toStatus: WorkOrderStatus, notes: string) {
    if (!user) return
    setIsBulkWorking(true)
    await Promise.all(ids.map((id) => transitionWorkOrderStatus(id, toStatus, user.id, notes, user.role)))
    setIsBulkWorking(false)
    setRefreshKey((k) => k + 1)
  }

  async function handleBulkCertify() {
    const ids = orders.filter((o) => o.status === 'rueckmeldung_sent' && selected.has(o.id)).map((o) => o.id)
    if (!ids.length) return
    await bulkTransition(ids, 'internally_certified', 'Bulk intern zertifiziert durch Admin')
  }

  async function handleBulkSendToClient() {
    const ids = orders.filter((o) => o.status === 'internally_certified' && selected.has(o.id)).map((o) => o.id)
    if (!ids.length) return
    await bulkTransition(ids, 'sent_to_client', 'Bulk an Kunden gesendet')
  }

  async function handleBulkInvoice() {
    const invoiceNum = bulkInvoiceModal.invoiceNumber.trim()
    if (!invoiceNum) return
    const ids = orders.filter((o) => o.status === 'client_accepted' && selected.has(o.id)).map((o) => o.id)
    if (!ids.length) return
    setBulkInvoiceModal({ open: false, invoiceNumber: '' })
    await bulkTransition(ids, 'invoiced', `Rechnung: ${invoiceNum}`)
  }

  function handleExcelExport() {
    const selectedOrders = selected.size > 0
      ? orders.filter((o) => selected.has(o.id))
      : orders

    const rows = selectedOrders.map((o) => ({
      'Auftragsnummer': o.order_number,
      'Typ': WORK_TYPE_LABELS[o.work_type],
      'Status': STATUS_LABELS[o.status] ?? o.status,
      'Kunde': o.clients?.name ?? '',
      'Projekt': o.projects?.code ?? '',
      'Team': o.assigned_team ?? '',
      'Einsatzdatum': o.assigned_date
        ? new Date(o.assigned_date).toLocaleDateString('de-DE')
        : '',
      'Priorität': o.priority,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Zertifizierung')
    XLSX.writeFile(wb, `LUMEN_Zertifizierung_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // Derive bulk action availability
  const selectedCertifiable = orders.filter((o) => o.status === 'rueckmeldung_sent' && selected.has(o.id)).length
  const selectedSendable = orders.filter((o) => o.status === 'internally_certified' && selected.has(o.id)).length
  const selectedInvoiceable = orders.filter((o) => o.status === 'client_accepted' && selected.has(o.id)).length
  const hasSelection = selected.size > 0

  const total = orders.length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-gf-text">Zertifizierung</h2>
          <p className="mt-1 text-sm text-gf-text-muted">
            {total === 0 ? 'Keine Aufträge im Prozess' : `${total} Aufträge im Prozess`}
          </p>
        </div>
        <button
          onClick={handleExcelExport}
          disabled={total === 0}
          className="flex items-center gap-1.5 rounded-gf-btn border border-gf-border px-3 py-1.5 text-xs font-medium text-gf-text-muted hover:border-gf-primary hover:text-gf-primary disabled:opacity-40 transition-colors"
        >
          📊 Excel {hasSelection ? `(${selected.size})` : ''}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value as TeamColor | '')}
          className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-1.5 text-sm text-gf-text focus:border-gf-primary focus:outline-none"
        >
          <option value="">Alle Teams</option>
          <option value="rot">Rot</option>
          <option value="gruen">Grün</option>
          <option value="blau">Blau</option>
          <option value="gelb">Gelb</option>
        </select>

        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-1.5 text-sm text-gf-text focus:border-gf-primary focus:outline-none"
        >
          <option value="">Alle Projekte</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
          ))}
        </select>

        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-1.5 text-sm text-gf-text focus:border-gf-primary focus:outline-none"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-1.5 text-sm text-gf-text focus:border-gf-primary focus:outline-none"
        />

        {(filterTeam || filterProject || filterDateFrom || filterDateTo) && (
          <button
            onClick={() => {
              setFilterTeam('')
              setFilterProject('')
              setFilterDateFrom('')
              setFilterDateTo('')
            }}
            className="rounded-gf-btn border border-gf-danger/30 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-gf-danger/10 transition-colors"
          >
            × Filter löschen
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {hasSelection && (
        <div className="flex flex-wrap items-center gap-3 rounded-gf-card border border-gf-primary/30 bg-gf-primary/5 px-4 py-3">
          <span className="text-sm font-semibold text-gf-primary-dark">{selected.size} ausgewählt</span>
          <div className="flex flex-wrap gap-2 ml-auto">
            {selectedCertifiable > 0 && (
              <button
                disabled={isBulkWorking}
                onClick={() => void handleBulkCertify()}
                className="rounded-gf-btn bg-gf-success px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isBulkWorking ? '…' : `✓ Intern zertifizieren (${selectedCertifiable})`}
              </button>
            )}
            {selectedSendable > 0 && (
              <button
                disabled={isBulkWorking}
                onClick={() => void handleBulkSendToClient()}
                className="rounded-gf-btn bg-gf-primary px-3 py-1.5 text-xs font-semibold text-gf-base hover:bg-gf-primary-light disabled:opacity-50 transition-colors"
              >
                {isBulkWorking ? '…' : `📤 An Kunden senden (${selectedSendable})`}
              </button>
            )}
            {selectedInvoiceable > 0 && (
              <button
                disabled={isBulkWorking}
                onClick={() => setBulkInvoiceModal({ open: true, invoiceNumber: '' })}
                className="rounded-gf-btn bg-gf-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {`🧾 Fakturieren (${selectedInvoiceable})`}
              </button>
            )}
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-gf-btn border border-gf-border px-3 py-1.5 text-xs font-medium text-gf-text-muted hover:border-gf-primary hover:text-gf-primary transition-colors"
            >
              Auswahl aufheben
            </button>
          </div>
        </div>
      )}

      {/* Sections */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gf-border border-t-gf-primary" />
        </div>
      ) : total === 0 ? (
        <div className="rounded-gf-card border border-gf-border bg-gf-card px-6 py-12 text-center">
          <p className="text-gf-text-muted">Keine Aufträge im Zertifizierungsprozess.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {SECTIONS.map(({ status, label, description }) => {
            const items = byStatus(status)
            if (items.length === 0) return null
            const allSectionSelected = items.every((o) => selected.has(o.id))
            return (
              <div key={status}>
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allSectionSelected}
                    onChange={() => toggleSection(status)}
                    className="h-3.5 w-3.5 rounded accent-gf-primary cursor-pointer"
                  />
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-sm font-semibold text-gf-text">{label}</span>
                  <span className="text-xs text-gf-text-muted">— {description}</span>
                  <span className="ml-auto text-xs text-gf-text-muted">{items.length}</span>
                </div>
                <div className="overflow-hidden rounded-gf-card border border-gf-border bg-gf-card">
                  {items.map((order, i) => (
                    <div
                      key={order.id}
                      className={`flex w-full items-center gap-3 px-4 py-3.5 transition-colors ${
                        selected.has(order.id) ? 'bg-gf-primary/5' : 'hover:bg-gf-surface'
                      } ${i < items.length - 1 ? 'border-b border-gf-border' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(order.id)}
                        onChange={() => toggleOne(order.id)}
                        className="h-3.5 w-3.5 rounded accent-gf-primary cursor-pointer shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                        className="flex flex-1 items-center gap-4 text-left min-w-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-gf-text">{order.order_number}</span>
                            <span className="text-xs text-gf-text-muted">{WORK_TYPE_LABELS[order.work_type]}</span>
                          </div>
                          <p className="text-xs text-gf-text-muted">
                            {order.clients?.name ?? '—'} · {order.projects?.code ?? '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {order.assigned_team && (
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${TEAM_DOT[order.assigned_team]}`} />
                              <span className="text-xs capitalize text-gf-text-muted">{order.assigned_team}</span>
                            </div>
                          )}
                          {order.assigned_date && (
                            <span className="text-xs text-gf-text-muted">
                              {new Date(order.assigned_date).toLocaleDateString('de-DE')}
                            </span>
                          )}
                          <span className="text-xs text-gf-text-muted">→</span>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bulk invoice modal */}
      {bulkInvoiceModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setBulkInvoiceModal({ open: false, invoiceNumber: '' }) }}
        >
          <div className="w-full max-w-sm rounded-gf-card border border-gf-border bg-gf-card p-6 shadow-gf-modal">
            <h3 className="mb-2 font-display text-base font-bold text-gf-text">Sammel-Fakturierung</h3>
            <p className="mb-3 text-sm text-gf-text-muted">
              Rechnungsnummer für {selectedInvoiceable} Aufträge (Pflichtfeld).
            </p>
            <input
              type="text"
              value={bulkInvoiceModal.invoiceNumber}
              onChange={(e) => setBulkInvoiceModal((m) => ({ ...m, invoiceNumber: e.target.value }))}
              placeholder="z.B. RE-2026-0042"
              autoFocus
              className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text placeholder-gf-text-placeholder focus:border-gf-primary focus:outline-none mb-5"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setBulkInvoiceModal({ open: false, invoiceNumber: '' })}
                className="rounded-gf-btn border border-gf-border px-4 py-2 text-sm font-medium text-gf-text-muted hover:border-gf-primary hover:text-gf-primary transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => void handleBulkInvoice()}
                disabled={!bulkInvoiceModal.invoiceNumber.trim() || isBulkWorking}
                className="rounded-gf-btn bg-gf-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isBulkWorking ? '…' : 'Fakturieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
