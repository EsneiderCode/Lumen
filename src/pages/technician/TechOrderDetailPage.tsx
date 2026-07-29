import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Play, Check, PencilLine, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchWorkOrder,
  fetchStateHistory,
  transitionWorkOrderStatus,
  type WorkOrderWithRelations,
} from '@/services/workOrderService'
import { fetchCapturePlanForOrder, fetchCaptureReport } from '@/services/capturePlanService'
import { captureDetailEntries } from '@/services/capturePlanEngine'
import type { CaptureDetailEntry } from '@/types/capture-plan'
import type { WorkOrderStatus } from '@/types/enums'
import { useTranslation } from 'react-i18next'
import { useLabels } from '@/i18n/labels'
import { STATUS_COLORS, TEAM_DOT } from '@/constants/styles'
import { orderSiteRef } from '@/lib/orderSiteRef'

interface StateHistoryEntry {
  id: string
  from_status: WorkOrderStatus | null
  to_status: WorkOrderStatus
  changed_by: string
  notes: string | null
  created_at: string
}

export function TechOrderDetailPage() {
  const { t } = useTranslation()
  const L = useLabels()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order, setOrder] = useState<WorkOrderWithRelations | null>(null)
  const [detail, setDetail] = useState<CaptureDetailEntry[]>([])
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

      // The technical data the admin pre-filled, read through the order's plan.
      const [plan, { data: report }] = await Promise.all([
        fetchCapturePlanForOrder(orderData),
        fetchCaptureReport(id),
      ])
      setDetail(captureDetailEntries(plan, report?.answers ?? {}))
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
        <div className="nx-loader" />
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

  const hasDetail = detail.length > 0

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
            <span className={`shrink-0 badge badge-dot ${STATUS_COLORS[order.status]}`}>
              {L.status(order.status)}
            </span>
          </div>
          <p className="text-xs text-fg-2">
            {orderSiteRef(order) && (
              <span className="font-mono font-semibold text-fg-1">{orderSiteRef(order)} · </span>
            )}
            {L.orderType(order)} · {order.line}
          </p>
        </div>
      </div>

      {/* Action buttons — status transitions */}
      {order.status === 'assigned' && (
        <button
          disabled={isTransitioning}
          onClick={() => handleTransition('in_progress', 'Arbeit begonnen')}
          className="w-full rounded-s bg-err px-4 py-3.5 text-sm font-semibold text-ink hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isTransitioning ? (
            t('tech.updatingStatus')
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              <Play size={14} strokeWidth={1.5} />
              {t('tech.startWork')}
            </span>
          )}
        </button>
      )}

      {order.status === 'in_progress' && (
        <button
          disabled={isTransitioning}
          onClick={() => handleTransition('executed', 'Ausführung abgeschlossen')}
          className="w-full rounded-s bg-warn px-4 py-3.5 text-sm font-semibold text-ink hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isTransitioning ? (
            t('tech.updatingStatus')
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              <Check size={14} strokeWidth={1.5} />
              {t('tech.completeWork')}
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
          {t('tech.fillRueckmeldung')}
        </button>
      )}

      {order.status === 'rueckmeldung_sent' && (
        <div className="rounded-l border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          {t('tech.rueckmeldungSentInfo')}
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
                  {t('tech.returnedBanner')}
                </p>
                {returnEntry?.notes && (
                  <p className="mt-1 text-sm text-err">{returnEntry.notes}</p>
                )}
              </>
            )
          })()}
          <button
            onClick={() => navigate(`/tech/orders/${order.id}/rueckmeldung`)}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-s bg-err px-4 py-3 text-sm font-semibold text-ink hover:opacity-90 transition-opacity"
          >
            <PencilLine size={14} strokeWidth={1.5} />
            {t('tech.correctRueckmeldung')}
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
        <h3 className="mb-3 font-display text-sm font-semibold text-fg-1">{t('tech.orderDetails')}</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-fg-2">{t('workOrder.customer')}</p>
            <p className="font-medium text-fg-1">{order.clients?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-2">{t('workOrder.project')}</p>
            <p className="font-medium text-fg-1">{order.projects?.code ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-2">{t('workOrder.operator')}</p>
            <p className="font-medium text-fg-1">{order.operators?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-2">{t('workOrder.team')}</p>
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
              <p className="text-xs text-fg-2">{t('workOrder.deploymentDate')}</p>
              <p className="font-medium text-fg-1">
                {new Date(order.assigned_date).toLocaleDateString('de-DE')}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-fg-2">{t('workOrder.priority')}</p>
            <p className="font-medium text-fg-1 capitalize">{order.priority}</p>
          </div>
          {(order.address || order.city) && (
            <div className="col-span-2">
              <p className="text-xs text-fg-2">{t('workOrder.address')}</p>
              <p className="font-medium text-fg-1">
                {[order.address, order.postal_code, order.city].filter(Boolean).join(', ')}
              </p>
            </div>
          )}
          {order.internal_notes && (
            <div className="col-span-2">
              <p className="text-xs text-fg-2">{t('common.notes')}</p>
              <p className="font-medium text-fg-1">{order.internal_notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Technical details (pre-filled by admin) */}
      {hasDetail && (
        <div className="rounded-l border border-line bg-bg-1 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-fg-1">
            {t('tech.technicalSpecs', { workType: L.workType(order.work_type) })}
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {detail.map(({ key, labelKey, value }) => (
              <div key={key}>
                <p className="text-xs capitalize text-fg-2">{t(labelKey)}</p>
                <p className="font-medium text-fg-1">
                  {typeof value === 'boolean' ? (value ? t('common.yes') : t('common.no')) : String(value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* State history */}
      {history.length > 0 && (
        <div className="rounded-l border border-line bg-bg-1 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-fg-1">{t('tech.history')}</h3>
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
