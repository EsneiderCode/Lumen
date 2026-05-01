import { useEffect, useState } from 'react'
import {
  fetchBillingLines,
  fetchCertificationAudits,
  type CollaboratorType,
} from '@/services/workOrderService'

interface OrderShape {
  id: string
  order_number: string
  client_id: string | null
  clients: { name: string; code: string } | null
}

interface BillingLineRow {
  id: string
  service_item_id: string
  qty: number
  unit_price_snapshot: number
  unit_price_external_snapshot: number | null
  service_items: {
    code: string
    description_de: string
    description_es: string | null
    unit: string | null
  } | null
}

interface Props {
  order: OrderShape
  collaboratorType: CollaboratorType
  onClose: () => void
  onConfirm: (invoiceNumber: string, totalNote: string) => Promise<void> | void
}

/**
 * Admin-only invoice preview before transitioning to `invoiced`.
 *
 * - Shows the line items the technician declared on the Rückmeldung.
 * - For internal orders → 1 amount column (client side).
 * - For external orders → 2 amount columns (client side + external side) plus margin.
 * - Reads cert audits to flag missing client/external certifications, but
 *   never blocks invoicing on its own — Phase 1 enforcement in
 *   transitionWorkOrderStatus is the actual gate.
 *
 * Replaces the LUM-018 invoice-number prompt: invoice-number stays as an
 * optional free-text field that the admin keys into state_history.notes
 * (DATEV is the system of record for the actual Rechnungsnummer).
 */
export function InvoicePreviewModal({ order, collaboratorType, onClose, onConfirm }: Props) {
  const [lines, setLines] = useState<BillingLineRow[]>([])
  const [hasClientCert, setHasClientCert] = useState(false)
  const [hasExternalCert, setHasExternalCert] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)

  const isExternal = collaboratorType === 'external'
  const isDirect = order.client_id == null

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [{ data: billing }, { data: audits }] = await Promise.all([
        fetchBillingLines(order.id),
        fetchCertificationAudits(order.id),
      ])
      if (cancelled) return
      setLines(billing as unknown as BillingLineRow[])
      setHasClientCert(audits.some((a) => a.cert_type === 'client'))
      setHasExternalCert(audits.some((a) => a.cert_type === 'external'))
      setIsLoading(false)
    })()
    return () => { cancelled = true }
  }, [order.id])

  const totalClient = lines.reduce((acc, l) => acc + Number(l.qty) * Number(l.unit_price_snapshot), 0)
  const totalExternal = lines.reduce(
    (acc, l) => acc + (l.unit_price_external_snapshot != null ? Number(l.qty) * Number(l.unit_price_external_snapshot) : 0),
    0,
  )
  const margin = totalClient - totalExternal

  const fmt = (n: number) =>
    n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

  // Soft-warning rules:
  // - With-client orders WITHOUT a cert_type='client' audit → block-soft (Phase 1 enforcement also blocks server-side).
  // - External collaborator WITHOUT cert_type='external' audit → warn but don't block (external cert is parallel).
  const blockingMissingClientCert = !isDirect && !hasClientCert
  const warnMissingExternalCert = isExternal && !hasExternalCert

  async function handleConfirm() {
    setIsConfirming(true)
    const noteParts: string[] = []
    if (invoiceNumber.trim()) noteParts.push(`Rechnung: ${invoiceNumber.trim()}`)
    noteParts.push(`Brutto Kunde: ${fmt(totalClient)}`)
    if (isExternal) {
      noteParts.push(`Brutto extern: ${fmt(totalExternal)}`)
      noteParts.push(`Marge: ${fmt(margin)}`)
    }
    await onConfirm(invoiceNumber.trim(), noteParts.join(' · '))
    setIsConfirming(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/95 px-4 py-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-3xl rounded-l border border-line bg-bg-1 overflow-hidden">
        <div className="h-0.5 w-full bg-accent" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-line bg-bg-0 px-6 py-4 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-fg-2">Fakturierung — Vorschau</p>
            <h3 className="font-display text-base font-bold text-fg-1 mt-0.5">
              {order.order_number}
            </h3>
            <p className="text-xs text-fg-2 mt-1">
              {isDirect ? '— Direktauftrag —' : `Kunde: ${order.clients?.name ?? '—'}`}
              {isExternal && (
                <span className="ml-2 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-accent">
                  Extern
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-s border border-line text-fg-2 hover:border-fg-1 hover:text-fg-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent" />
            </div>
          ) : lines.length === 0 ? (
            <div className="rounded-s border border-err/30 bg-err/5 px-4 py-3 text-sm text-err">
              Keine Posten in dieser Auftragszeile. Fakturierung blockiert — der Techniker
              muss zuerst die Rückmeldung mit Posten ausfüllen.
            </div>
          ) : (
            <>
              {/* Lines table */}
              <div className="overflow-hidden rounded-s border border-line">
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-bg-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-fg-2">Code</th>
                      <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-fg-2">Leistung</th>
                      <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-fg-2">Menge</th>
                      <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-fg-2">Preis Kunde</th>
                      <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-fg-2">Subtotal Kunde</th>
                      {isExternal && (
                        <>
                          <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-fg-2">Preis extern</th>
                          <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-fg-2">Subtotal extern</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const subClient = Number(l.qty) * Number(l.unit_price_snapshot)
                      const subExt = l.unit_price_external_snapshot != null
                        ? Number(l.qty) * Number(l.unit_price_external_snapshot)
                        : null
                      return (
                        <tr key={l.id} className="border-t border-line/60">
                          <td className="px-3 py-2 font-mono text-xs font-semibold text-accent whitespace-nowrap">
                            {l.service_items?.code ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-fg-1">
                            {l.service_items?.description_de ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-fg-1 whitespace-nowrap">
                            {Number(l.qty)} {l.service_items?.unit ?? ''}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-fg-2 whitespace-nowrap">
                            {fmt(Number(l.unit_price_snapshot))}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums text-fg-1 whitespace-nowrap">
                            {fmt(subClient)}
                          </td>
                          {isExternal && (
                            <>
                              <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-fg-2 whitespace-nowrap">
                                {l.unit_price_external_snapshot != null ? fmt(Number(l.unit_price_external_snapshot)) : '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums text-fg-1 whitespace-nowrap">
                                {subExt != null ? fmt(subExt) : '—'}
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="rounded-s border border-line bg-bg-0 p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-fg-2">Brutto Kunde</span>
                  <span className="font-mono text-base font-semibold text-fg-1 tabular-nums">{fmt(totalClient)}</span>
                </div>
                {isExternal && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-fg-2">Brutto extern</span>
                      <span className="font-mono text-base font-semibold text-fg-1 tabular-nums">{fmt(totalExternal)}</span>
                    </div>
                    <div className="border-t border-line/60 pt-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-accent">Marge</span>
                      <span className={`font-mono text-base font-bold tabular-nums ${margin >= 0 ? 'text-ok' : 'text-err'}`}>
                        {fmt(margin)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Cert warnings */}
              {blockingMissingClientCert && (
                <div className="rounded-s border border-err/40 bg-err/10 px-4 py-3 text-sm text-err">
                  Kundenakzeptanz fehlt — Fakturierung wird vom Server blockiert.
                  Erst <code className="font-mono">cert_type=&apos;client&apos;</code> registrieren.
                </div>
              )}
              {warnMissingExternalCert && (
                <div className="rounded-s border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
                  Externe Zertifizierung steht aus. Fakturierung an den Kunden bleibt
                  erlaubt — Auszahlung an den Subunternehmer erst nach
                  <code className="font-mono mx-1">cert_type=&apos;external&apos;</code> möglich.
                </div>
              )}

              {/* Optional invoice number reference */}
              <div>
                <label className="mb-1 block text-xs font-medium text-fg-2">
                  Rechnungsnummer (optional, frei) — als Referenz im Statusverlauf
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="z.B. RE-2026-0042"
                  className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <p className="mt-1 text-[11px] text-fg-2">
                  DATEV ist der eigentliche Rechnungsregister — dieses Feld dient nur als
                  Lumen-interner Vermerk in der Statushistorie.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-line bg-bg-0 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="rounded-s border border-line px-4 py-2 text-sm text-fg-2 hover:border-fg-1 hover:text-fg-1 disabled:opacity-50 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={isLoading || isConfirming || lines.length === 0 || blockingMissingClientCert}
            className="rounded-s bg-accent px-5 py-2 text-sm font-semibold text-ink hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {isConfirming ? 'Wird fakturiert…' : 'Fakturierung bestätigen'}
          </button>
        </div>
      </div>
    </div>
  )
}
