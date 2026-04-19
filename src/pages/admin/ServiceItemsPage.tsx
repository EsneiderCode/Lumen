import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { fetchServiceItems } from '@/services/serviceItemService'
import type { ServiceItemWithRelations } from '@/types/service-items'

/**
 * Service catalog — read-only list of rate-card items sourced from
 * the operator contracts. Admins reference these when creating work
 * orders so invoice line items stay aligned with the contract.
 */
export function ServiceItemsPage() {
  const [items, setItems] = useState<ServiceItemWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [operatorFilter, setOperatorFilter] = useState<string>('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetchServiceItems({ includeInactive }).then(({ data }) => {
      if (!cancelled) {
        setItems(data)
        setIsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [includeInactive])

  const operators = Array.from(
    new Map(items.filter((i) => i.operators).map((i) => [i.operators!.id, i.operators!])).values(),
  )

  const q = search.trim().toLowerCase()
  const filtered = items.filter((i) => {
    if (operatorFilter && i.operator_id !== operatorFilter) return false
    if (!q) return true
    return (
      i.code.toLowerCase().includes(q) ||
      i.description_de.toLowerCase().includes(q) ||
      (i.description_es ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-fg-1">Service-Katalog</h2>
          <p className="text-sm text-fg-2">
            {filtered.length} Artikel — Vertragliche Leistungscodes
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          type="text"
          placeholder="Suchen (Code oder Beschreibung)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <select
          value={operatorFilter}
          onChange={(e) => setOperatorFilter(e.target.value)}
          className="rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Alle Betreiber / Global</option>
          {operators.map((op) => (
            <option key={op.id} value={op.id}>{op.code} — {op.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          <span>Inaktive anzeigen</span>
        </label>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-l border border-line bg-bg-1 py-16 text-center">
          <FileText size={28} strokeWidth={1.5} className="mx-auto text-fg-3" />
          <p className="mt-2 text-sm font-medium text-fg-1">Keine Artikel gefunden</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-l border border-line bg-bg-1">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-bg-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-fg-2">Code</th>
                <th className="px-3 py-2 text-left font-medium text-fg-2">Beschreibung (DE)</th>
                <th className="px-3 py-2 text-left font-medium text-fg-2">Descripción (ES)</th>
                <th className="px-3 py-2 text-left font-medium text-fg-2">Einheit</th>
                <th className="px-3 py-2 text-right font-medium text-fg-2">Preis</th>
                <th className="px-3 py-2 text-left font-medium text-fg-2">Detail</th>
                <th className="px-3 py-2 text-left font-medium text-fg-2">Betreiber</th>
                <th className="px-3 py-2 text-left font-medium text-fg-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className={`border-t border-line/50 ${!item.active ? 'opacity-50' : ''}`}
                >
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-accent whitespace-nowrap">
                    {item.code}
                  </td>
                  <td className="px-3 py-3 text-fg-1">{item.description_de}</td>
                  <td className="px-3 py-3 text-fg-2">
                    {item.description_es ?? <span className="italic text-fg-4">—</span>}
                  </td>
                  <td className="px-3 py-3 text-fg-2 font-mono text-xs">
                    {item.unit ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-fg-1">
                    {item.unit_price != null
                      ? `${item.unit_price.toFixed(2)} €`
                      : <span className="italic text-fg-4">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    {item.detail_form
                      ? <span className="rounded bg-bg-0 px-1.5 py-0.5 font-mono text-xs text-fg-2">{item.detail_form}</span>
                      : '—'}
                  </td>
                  <td className="px-3 py-3 text-fg-2 font-mono text-xs">
                    {item.operators?.code ?? <span className="italic">Global</span>}
                  </td>
                  <td className="px-3 py-3">
                    {item.active
                      ? <span className="inline-flex rounded-full bg-ok/15 px-2 py-0.5 text-xs font-medium text-ok">Aktiv</span>
                      : <span className="inline-flex rounded-full bg-err/10 px-2 py-0.5 text-xs font-medium text-fg-2">Inaktiv</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
