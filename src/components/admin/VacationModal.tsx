import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Check, X, CalendarDays, AlertTriangle } from 'lucide-react'
import {
  fetchVacationRequests,
  createVacationRequest,
  updateVacationStatus,
  deleteVacationRequest,
  type Employee,
  type VacationRequest,
} from '@/services/employeeService'
import { useAuth } from '@/context/AuthContext'

// ── Constants ─────────────────────────────────────────────────────────────────

const BURBLG_MIN_DAYS = 20 // BUrlG § 3 minimum

// ── Helpers ───────────────────────────────────────────────────────────────────

function countWeekdays(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  if (e < s) return 0
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function statusBadge(status: VacationRequest['status']) {
  const map: Record<VacationRequest['status'], { label: string; cls: string }> = {
    pending:  { label: 'OFFEN',      cls: 'border-gf-warning/40 bg-gf-warning/10 text-gf-warning' },
    approved: { label: 'GENEHMIGT', cls: 'border-gf-success/40 bg-gf-success/10 text-gf-success' },
    rejected: { label: 'ABGELEHNT', cls: 'border-gf-danger/30 bg-gf-accent-light text-gf-danger' },
  }
  const { label, cls } = map[status]
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${cls}`}>
      {label}
    </span>
  )
}

// ── VacationModal ─────────────────────────────────────────────────────────────

interface VacationModalProps {
  employee: Employee
  onClose: () => void
}

const EMPTY_FORM = {
  start_date: '',
  end_date: '',
  notes: '',
}

export function VacationModal({ employee, onClose }: VacationModalProps) {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [requests, setRequests] = useState<VacationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await fetchVacationRequests(employee.id, year)
    if (err) setError(err)
    setRequests(data)
    setLoading(false)
  }, [employee.id, year])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // ── Derived stats ─────────────────────────────────────────────────────────

  const approvedDays = requests
    .filter((r) => r.status === 'approved')
    .reduce((s, r) => s + r.days_count, 0)

  const pendingDays = requests
    .filter((r) => r.status === 'pending')
    .reduce((s, r) => s + r.days_count, 0)

  const autodays = form.start_date && form.end_date
    ? countWeekdays(form.start_date, form.end_date)
    : 0

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.start_date || !form.end_date) {
      setError('Datumangaben fehlen.')
      return
    }
    if (autodays <= 0) {
      setError('Ungültiger Zeitraum.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = await createVacationRequest({
      employee_id: employee.id,
      year,
      start_date: form.start_date,
      end_date: form.end_date,
      days_count: autodays,
      notes: form.notes || null,
    })
    setSaving(false)
    if (err) { setError(err); return }
    setForm(EMPTY_FORM)
    setAdding(false)
    load()
  }

  const handleApprove = async (req: VacationRequest) => {
    if (!user?.id) return
    const { error: err } = await updateVacationStatus(req.id, 'approved', user.id)
    if (err) { setError(err); return }
    load()
  }

  const handleReject = async (req: VacationRequest) => {
    if (!user?.id) return
    const { error: err } = await updateVacationStatus(req.id, 'rejected', user.id)
    if (err) { setError(err); return }
    load()
  }

  const handleDelete = async (req: VacationRequest) => {
    if (!window.confirm('Urlaubsantrag löschen?')) return
    const { error: err } = await deleteVacationRequest(req.id)
    if (err) { setError(err); return }
    load()
  }

  const setField = (k: keyof typeof EMPTY_FORM, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  // ── Render ────────────────────────────────────────────────────────────────

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gf-base/80 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-gf-card border border-gf-border bg-gf-card max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gf-border px-5 py-4 shrink-0">
          <div>
            <h2 className="font-sans text-sm font-medium text-gf-text">Urlaubsverwaltung</h2>
            <p className="mt-0.5 font-mono text-xs text-gf-text-muted">{employee.full_name}</p>
          </div>
          <button onClick={onClose} className="text-gf-text-muted hover:text-gf-text">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="overflow-auto flex-1 p-5 space-y-4">

          {/* Year + BUrlG stats */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="mb-1 block font-mono text-[10px] text-gf-text-label">JAHR</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text focus:border-gf-primary focus:outline-none"
              >
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* BUrlG counter */}
            <div className="flex gap-3 text-center">
              <Stat label="GENEHMIGT" value={approvedDays} ok={approvedDays >= BURBLG_MIN_DAYS} unit="Tage" />
              <Stat label="OFFEN" value={pendingDays} unit="Tage" />
              <Stat label="BÜRLG MIN." value={BURBLG_MIN_DAYS} unit="Tage" />
            </div>
          </div>

          {/* BUrlG warning */}
          {approvedDays < BURBLG_MIN_DAYS && (
            <div className="flex items-start gap-2 rounded-gf-card border border-gf-warning/30 bg-gf-warning/5 px-3 py-2">
              <AlertTriangle size={12} strokeWidth={1.5} className="mt-0.5 shrink-0 text-gf-warning" />
              <p className="font-sans text-[11px] text-gf-warning">
                Genehmigter Urlaub ({approvedDays} Tage) liegt unter dem gesetzlichen Mindestanspruch von {BURBLG_MIN_DAYS} Tagen (BUrlG § 3).
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="rounded-gf-card border border-gf-accent/30 bg-gf-accent-light px-3 py-2 font-sans text-xs text-gf-accent">
              {error}
            </p>
          )}

          {/* Request list */}
          <div className="rounded-gf-card border border-gf-border">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="nx-loader" />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <CalendarDays size={28} strokeWidth={1} className="text-gf-text-muted" />
                <p className="font-sans text-xs text-gf-text-muted">Keine Urlaubsanträge für {year}.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gf-border">
                    <th className="px-3 py-2 text-left font-mono text-[10px] text-gf-text-label">ZEITRAUM</th>
                    <th className="px-3 py-2 text-center font-mono text-[10px] text-gf-text-label">TAGE</th>
                    <th className="px-3 py-2 text-left font-mono text-[10px] text-gf-text-label">STATUS</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-b border-gf-border last:border-0 hover:bg-gf-base-light/30">
                      <td className="px-3 py-2">
                        <p className="font-mono text-xs text-gf-text">
                          {new Date(req.start_date).toLocaleDateString('de-DE')} –{' '}
                          {new Date(req.end_date).toLocaleDateString('de-DE')}
                        </p>
                        {req.notes && (
                          <p className="mt-0.5 font-sans text-[11px] text-gf-text-muted">{req.notes}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="font-mono text-sm text-gf-text">{req.days_count}</span>
                      </td>
                      <td className="px-3 py-2">{statusBadge(req.status)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {req.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(req)}
                                className="rounded p-1 text-gf-text-muted hover:text-gf-success"
                                title="Genehmigen"
                              >
                                <Check size={13} strokeWidth={2} />
                              </button>
                              <button
                                onClick={() => handleReject(req)}
                                className="rounded p-1 text-gf-text-muted hover:text-gf-danger"
                                title="Ablehnen"
                              >
                                <X size={13} strokeWidth={2} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(req)}
                            className="rounded p-1 text-gf-text-muted hover:text-gf-danger"
                            title="Löschen"
                          >
                            <Trash2 size={13} strokeWidth={1.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Add request form */}
          {adding ? (
            <form onSubmit={handleCreate} className="rounded-gf-card border border-gf-border p-4 space-y-3">
              <p className="font-mono text-[10px] text-gf-text-label">NEUER URLAUBSANTRAG</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-mono text-[10px] text-gf-text-muted">VON *</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setField('start_date', e.target.value)}
                    required
                    className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text focus:border-gf-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] text-gf-text-muted">BIS *</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setField('end_date', e.target.value)}
                    required
                    className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text focus:border-gf-primary focus:outline-none"
                  />
                </div>
              </div>

              {autodays > 0 && (
                <p className="font-mono text-xs text-gf-primary">
                  {autodays} Arbeitstag{autodays !== 1 ? 'e' : ''} (Mo–Fr, ohne gesetzl. Feiertage)
                </p>
              )}

              <div>
                <label className="mb-1 block font-mono text-[10px] text-gf-text-muted">NOTIZ</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text placeholder-gf-text-placeholder focus:border-gf-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setAdding(false); setForm(EMPTY_FORM) }}
                  className="rounded-gf-btn border border-gf-border px-3 py-1.5 font-sans text-sm text-gf-text-muted hover:text-gf-text"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving || autodays <= 0}
                  className="rounded-gf-btn bg-gf-primary px-3 py-1.5 font-sans text-sm text-gf-text-inverse disabled:opacity-50"
                >
                  {saving ? 'Speichern…' : 'Antrag einreichen'}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-2 rounded-gf-btn border border-dashed border-gf-border py-2 font-sans text-sm text-gf-text-muted transition-colors hover:border-gf-primary hover:text-gf-primary"
            >
              <Plus size={13} strokeWidth={2} />
              Urlaubsantrag hinzufügen
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-gf-border px-5 py-3 shrink-0">
          <button
            onClick={onClose}
            className="rounded-gf-btn border border-gf-border px-4 py-2 font-sans text-sm text-gf-text-muted hover:text-gf-text"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stat badge ─────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  unit,
  ok,
}: {
  label: string
  value: number
  unit: string
  ok?: boolean
}) {
  return (
    <div className="flex flex-col items-center rounded-gf-card border border-gf-border px-3 py-2 min-w-[60px]">
      <span className="font-mono text-[10px] text-gf-text-label">{label}</span>
      <span
        className={`font-display text-lg font-bold tabular-nums ${
          ok === true ? 'text-gf-success' : ok === false ? 'text-gf-warning' : 'text-gf-text'
        }`}
      >
        {value}
      </span>
      <span className="font-mono text-[10px] text-gf-text-muted">{unit}</span>
    </div>
  )
}
