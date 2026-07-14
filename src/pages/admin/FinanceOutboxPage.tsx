import { useEffect, useState } from 'react'
import { RefreshCw, RotateCcw, Send } from 'lucide-react'
import {
  dispatchFinanceOutbox,
  listFinanceOutbox,
  requeueAllFailed,
  retryOutboxRow,
  type FinanceOutboxRow,
} from '@/services/financeOutboxService'
import {
  OUTBOX_STATUS_FILTERS,
  type OutboxStatusFilter,
  canRetryStatus,
  formatDateTime,
  statusBadgeClass,
  truncateError,
} from '@/lib/outboxFormat'

const FILTER_LABELS: Record<OutboxStatusFilter, string> = {
  all: 'Todos',
  pending: 'Pendientes',
  failed: 'Fallidos',
  dead: 'Muertos',
  sent: 'Enviados',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'pendiente',
  processing: 'procesando',
  sent: 'enviado',
  failed: 'fallido',
  dead: 'muerto',
}

/**
 * S6 — Observabilidad del outbox de finanzas (Lumen → FinControl).
 * Lista finance_outbox, filtra por estado, reintenta failed/dead y
 * dispara el dispatch (misma Edge Function que el botón Push de Ciclos).
 */
export function FinanceOutboxPage() {
  const [rows, setRows] = useState<FinanceOutboxRow[]>([])
  const [filter, setFilter] = useState<OutboxStatusFilter>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [dispatchBusy, setDispatchBusy] = useState(false)
  const [requeueBusy, setRequeueBusy] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // The effect owns the fetch (UsersPage pattern); actions and the manual
  // refresh button re-trigger it by bumping refreshKey.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const { data, error: err } = await listFinanceOutbox({
        status: filter === 'all' ? undefined : filter,
        limit: 100,
      })
      if (cancelled) return
      setRows(data)
      if (err) setError(err)
      setIsLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [filter, refreshKey])

  function reload() {
    setRefreshKey((k) => k + 1)
  }

  function changeFilter(next: OutboxStatusFilter) {
    setError(null)
    setMsg(null)
    setFilter(next)
  }

  async function handleRetry(id: string) {
    setRetryingId(id)
    setMsg(null)
    setError(null)
    const r = await retryOutboxRow(id)
    if (!r.ok) {
      setError(r.error ?? 'No se pudo reintentar el evento.')
    } else if (!r.retried) {
      setMsg('Nada que reintentar: el evento ya no está en failed/dead.')
    } else {
      setMsg('Evento re-encolado como pendiente. Usa «Dispatch ahora» para enviarlo.')
    }
    reload()
    setRetryingId(null)
  }

  async function handleRequeueAll() {
    setRequeueBusy(true)
    setMsg(null)
    setError(null)
    const r = await requeueAllFailed()
    if (!r.ok) {
      setError(r.error ?? 'No se pudieron reintentar los eventos fallidos.')
    } else {
      setMsg(`Re-encolados ${r.retried ?? 0} eventos failed/dead como pendientes.`)
    }
    reload()
    setRequeueBusy(false)
  }

  /** S5: mismo dispatch que el botón «Push outbox → FinControl» de Ciclos. */
  async function handleDispatch() {
    setDispatchBusy(true)
    setMsg(null)
    setError(null)
    try {
      const r = await dispatchFinanceOutbox({ limit: 50 })
      if (!r.ok) {
        setError(
          r.error ||
            'Dispatch falló. ¿Migration 038 aplicada? ¿Secrets FIREBASE_* en la Edge Function?',
        )
      } else {
        setMsg(
          `Outbox → FinControl: procesados ${r.processed ?? 0}, enviados ${r.sent ?? 0}, fallidos ${r.failed ?? 0}.`,
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    reload()
    setDispatchBusy(false)
  }

  const busy = dispatchBusy || requeueBusy || retryingId !== null

  return (
    <div className="space-y-5">
      <div className="nx-page-header flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Send size={22} strokeWidth={1.5} className="text-fg-2" />
          <div>
            <h2 className="nx-page-title">Outbox finanzas</h2>
            <p className="nx-label mt-2">
              Eventos Lumen → FinControl (CXC/CXP) · fallos visibles y reintentos
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-g btn-sm"
            disabled={isLoading || busy}
            onClick={reload}
          >
            <RefreshCw size={16} strokeWidth={1.5} />
            Actualizar
          </button>
          <button
            type="button"
            className="btn btn-g btn-sm"
            disabled={busy}
            onClick={() => void handleRequeueAll()}
            title="Re-encola todos los eventos failed/dead como pendientes"
          >
            <RotateCcw size={16} strokeWidth={1.5} />
            {requeueBusy ? 'Re-encolando…' : 'Reintentar fallidos'}
          </button>
          <button
            type="button"
            className="btn btn-p btn-sm"
            disabled={busy}
            onClick={() => void handleDispatch()}
            title="Empuja finance_outbox pending a Firestore FinControl (requiere secrets Edge Function)"
          >
            <Send size={16} strokeWidth={1.5} />
            {dispatchBusy ? 'Enviando…' : 'Dispatch ahora'}
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded-s border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          {msg}
        </div>
      )}

      {error && (
        <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {OUTBOX_STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => changeFilter(f)}
            className={`rounded-s border px-3 py-1.5 text-xs transition-colors ${
              filter === f
                ? 'border-accent text-accent'
                : 'border-line text-fg-2 hover:border-accent hover:text-accent'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-l border border-line bg-bg-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="nx-loader" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-fg-3">
            {filter === 'all'
              ? 'Sin eventos en el outbox.'
              : `Sin eventos con estado «${FILTER_LABELS[filter].toLowerCase()}».`}
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 nx-label">Creado</th>
                <th className="px-4 py-3 nx-label">Evento</th>
                <th className="px-4 py-3 nx-label">Clave</th>
                <th className="px-4 py-3 nx-label">Estado</th>
                <th className="px-4 py-3 nx-label text-right">Intentos</th>
                <th className="px-4 py-3 nx-label">Último error</th>
                <th className="px-4 py-3 nx-label">Enviado</th>
                <th className="px-4 py-3 nx-label text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-fg-2">
                    {formatDateTime(row.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-fg-1">{row.event_type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="break-all font-mono text-xs text-fg-2">
                      {row.idempotency_key}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-m border px-2 py-0.5 text-xs ${statusBadgeClass(row.status)}`}
                    >
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-fg-2">
                    {row.attempts}
                  </td>
                  <td className="max-w-64 px-4 py-3 text-xs text-fg-2">
                    {row.last_error ? (
                      expandedId === row.id ? (
                        <button
                          type="button"
                          onClick={() => setExpandedId(null)}
                          className="whitespace-pre-wrap break-all text-left text-err"
                          title="Clic para contraer"
                        >
                          {row.last_error}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setExpandedId(row.id)}
                          className="text-left text-err"
                          title={row.last_error}
                        >
                          {truncateError(row.last_error)}
                        </button>
                      )
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-fg-2">
                    {formatDateTime(row.sent_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canRetryStatus(row.status) && (
                      <button
                        type="button"
                        onClick={() => void handleRetry(row.id)}
                        disabled={busy}
                        className="rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
                      >
                        {retryingId === row.id ? 'Reintentando…' : 'Reintentar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
