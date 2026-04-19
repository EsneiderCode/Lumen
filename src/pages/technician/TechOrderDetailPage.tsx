import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Play, Check, PencilLine, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchWorkOrder,
  fetchWorkOrderDetail,
  fetchStateHistory,
  workTypeToDetailTable,
  transitionWorkOrderStatus,
  type WorkOrderWithRelations,
} from '@/services/workOrderService'
import type { WorkOrderStatus } from '@/types/enums'
import { useLabels } from '@/i18n/labels'
import { STATUS_COLORS, TEAM_DOT } from '@/constants/styles'

interface StateHistoryEntry {
  id: string
  from_status: WorkOrderStatus | null
  to_status: WorkOrderStatus
  changed_by: string
  notes: string | null
  created_at: string
}

export function TechOrderDetailPage() {
  const L = useLabels()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order, setOrder] = useState<WorkOrderWithRelations | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown>>({})
  const [history, setHistory] = useState<StateHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetchWorkOrder(id),
      fetchStateHistory(id),
    ]).then(async ([{ data: orderData, error: orderErr }, { data: histData }]) => {
      if (orderErr || !orderData) {
        setError(orderErr ?? 'Auftrag nicht gefunden')
        setIsLoading(false)
        return
      }
      setOrder(orderData)
      setHistory(histData as StateHistoryEntry[])

      // Load detail
      const table = workTypeToDetailTable(orderData.work_type)
      const { data: detailData } = await fetchWorkOrderDetail(table, id)
      if (detailData) {
        const { id: _i, work_order_id: _w, created_at: _c, ...rest } = detailData as Record<string, unknown>
        void _i; void _w; void _c
        setDetail(rest)
      }
      setIsLoading(false)
    })
  }, [id])

  async function handleTransition(toStatus: WorkOrderStatus, notes: string) {
    if (!id || !user) return
    setIsTransitioning(true)
    setError(null)
    const { data: updated, error } = await transitionWorkOrderStatus(id, toStatus, user.id, notes, user.role)
    if (error) {
      setError(error)
      setIsTransitioning(false)
    } else {
      setOrder((prev) => prev ? { ...prev, status: updated!.status } : prev)
      // Refresh history
      const { data: histData } = await fetchStateHistory(id)
      setHistory(histData as StateHistoryEntry[])
      setIsTransitioning(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
        {error ?? 'Auftrag nicht gefunden'}
      </div>
    )
  }

  const hasDetail = Object.values(detail).some((v) => v !== null && v !== '' && v !== false)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/tech/orders')}
          className="flex h-8 w-8 items-center justify-center rounded-s border border-line text-fg-2 hover:border-accent hover:text-accent transition-colors"
          aria-label="Zurück"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold text-fg-1 truncate">{order.order_number}</h2>
            <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
              {L.status(order.status)}
            </span>
          </div>
          <p className="text-xs text-fg-2">{L.workType(order.work_type)} · {order.line}</p>
        </div>
      </div>

      {/* Action buttons — status transitions */}
      {order.status === 'assigned' && (
        <button
          disabled={isTransitioning}
          onClick={() => handleTransition('in_progress', 'Arbeit begonnen')}
          className="w-full rounded-s bg-err px-4 py-3.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isTransitioning ? (
            'Wird aktualisiert…'
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              <Play size={14} strokeWidth={1.5} />
              In Bearbeitung setzen
            </span>
          )}
        </button>
      )}

      {order.status === 'in_progress' && (
        <button
          disabled={isTransitioning}
          onClick={() => handleTransition('executed', 'Ausführung abgeschlossen')}
          className="w-full rounded-s bg-warn px-4 py-3.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isTransitioning ? (
            'Wird aktualisiert…'
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              <Check size={14} strokeWidth={1.5} />
              Ausführung abgeschlossen
            </span>
          )}
        </button>
      )}

      {order.status === 'executed' && (
        <button
          onClick={() => navigate(`/tech/orders/${order.id}/rueckmeldung`)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-s bg-accent px-4 py-3.5 text-sm font-semibold text-ink hover:bg-accent transition-colors"
        >
          <PencilLine size={14} strokeWidth={1.5} />
          Rückmeldung ausfüllen
        </button>
      )}

      {order.status === 'rueckmeldung_sent' && (
        <div className="rounded-l border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          Rückmeldung wurde gesendet. Der Admin prüft die Daten.
        </div>
      )}

      {order.status === 'returned' && (
        <div className="rounded-l border border-err/50 bg-err/10 p-4">
          {(() => {
            const returnEntry = [...history].reverse().find((e) => e.to_status === 'returned')
            return (
              <>
                <p className="inline-flex items-center gap-2 font-semibold text-err">
                  <AlertTriangle size={16} strokeWidth={1.5} />
                  Auftrag zurückgegeben — Nichtkonformität
                </p>
                {returnEntry?.notes && (
                  <p className="mt-1 text-sm text-err">{returnEntry.notes}</p>
                )}
              </>
            )
          })()}
          <button
            onClick={() => navigate(`/tech/orders/${order.id}/rueckmeldung`)}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-s bg-err px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <PencilLine size={14} strokeWidth={1.5} />
            Rückmeldung korrigieren
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          {error}
        </div>
      )}

      {/* Order info */}
      <div className="rounded-l border border-line bg-bg-1 p-4">
        <h3 className="mb-3 font-display text-sm font-semibold text-fg-1">Auftragsdetails</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-fg-2">Kunde</p>
            <p className="font-medium text-fg-1">{order.clients?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-2">Projekt</p>
            <p className="font-medium text-fg-1">{order.projects?.code ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-2">Betreiber</p>
            <p className="font-medium text-fg-1">{order.operators?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-2">Team</p>
            <div className="flex items-center gap-1.5">
              {order.assigned_team && (
                <span className={`h-2 w-2 rounded-full ${TEAM_DOT[order.assigned_team]}`} />
              )}
              <span className="font-medium capitalize text-fg-1">
                {order.assigned_team ?? '—'}
              </span>
            </div>
          </div>
          {order.assigned_date && (
            <div>
              <p className="text-xs text-fg-2">Einsatzdatum</p>
              <p className="font-medium text-fg-1">
                {new Date(order.assigned_date).toLocaleDateString('de-DE')}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-fg-2">Priorität</p>
            <p className="font-medium text-fg-1 capitalize">{order.priority}</p>
          </div>
          {(order.address || order.city) && (
            <div className="col-span-2">
              <p className="text-xs text-fg-2">Adresse</p>
              <p className="font-medium text-fg-1">
                {[order.address, order.postal_code, order.city].filter(Boolean).join(', ')}
              </p>
            </div>
          )}
          {order.internal_notes && (
            <div className="col-span-2">
              <p className="text-xs text-fg-2">Notizen</p>
              <p className="font-medium text-fg-1">{order.internal_notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Technical details (pre-filled by admin) */}
      {hasDetail && (
        <div className="rounded-l border border-line bg-bg-1 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-fg-1">
            Technische Vorgaben — {L.workType(order.work_type)}
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {Object.entries(detail).map(([key, value]) => {
              if (value === null || value === '' || value === undefined) return null
              const label = key.replace(/_/g, ' ')
              return (
                <div key={key}>
                  <p className="text-xs capitalize text-fg-2">{label}</p>
                  <p className="font-medium text-fg-1">
                    {typeof value === 'boolean' ? (value ? 'Ja' : 'Nein') : String(value)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* State history */}
      {history.length > 0 && (
        <div className="rounded-l border border-line bg-bg-1 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-fg-1">Verlauf</h3>
          <ol className="space-y-2">
            {history.map((entry, i) => (
              <li key={entry.id} className="flex items-start gap-3">
                <div className="mt-1 flex flex-col items-center">
                  <div className={`h-2 w-2 rounded-full ${i === history.length - 1 ? 'bg-accent' : 'bg-line'}`} />
                  {i < history.length - 1 && <div className="mt-1 h-5 w-px bg-line" />}
                </div>
                <div className="flex-1 pb-1">
                  <p className="text-xs font-medium text-fg-1">
                    {entry.from_status
                      ? `${L.status(entry.from_status)} → ${L.status(entry.to_status)}`
                      : L.status(entry.to_status)}
                  </p>
                  {entry.notes && <p className="text-xs text-fg-2">{entry.notes}</p>}
                  <p className="text-xs text-fg-2">
                    {new Date(entry.created_at).toLocaleString('de-DE')}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
