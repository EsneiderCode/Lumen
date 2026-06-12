import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Plus, Search, UserRound, Pencil, UserX, ChevronDown, ChevronUp, Receipt, CalendarDays } from 'lucide-react'
import {
  fetchEmployees,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  type Employee,
  type EmployeePayload,
} from '@/services/employeeService'
import { fetchTechnicians, type TechnicianProfile } from '@/services/workOrderService'
import { PayrollSlipModal } from '@/components/admin/PayrollSlipModal'
import { VacationModal } from '@/components/admin/VacationModal'
import { TeamColor, type TeamColor as TeamColorType } from '@/types/enums'

const STEUERKLASSEN = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const
const TEAM_OPTIONS = [TeamColor.ROT, TeamColor.GRUEN, TeamColor.BLAU, TeamColor.GELB] as const

const EMPTY_FORM: EmployeePayload = {
  full_name: '',
  email: '',
  phone: '',
  sv_nummer: '',
  steuer_id: '',
  steuerklasse: null,
  iban: '',
  gross_salary: 0,
  start_date: new Date().toISOString().slice(0, 10),
  end_date: null,
  notes: '',
  team: null,
  profile_id: null,
  is_active: true,
}

function TeamChip({ team }: { team: TeamColorType | null }) {
  const { t } = useTranslation()
  if (!team) return <span className="font-mono text-xs text-gf-text-muted">—</span>
  return (
    <span className="rounded-full border border-gf-border px-2 py-0.5 font-mono text-xs text-gf-text-muted">
      {t('teamColor.' + team)}
    </span>
  )
}

interface EmployeeModalProps {
  employee: Employee | null
  technicians: TechnicianProfile[]
  onClose: () => void
  onSaved: () => void
}

function EmployeeModal({ employee, technicians, onClose, onSaved }: EmployeeModalProps) {
  const { t } = useTranslation()
  const isEdit = employee !== null
  const [form, setForm] = useState<EmployeePayload>(
    isEdit
      ? {
          full_name: employee.full_name,
          email: employee.email ?? '',
          phone: employee.phone ?? '',
          sv_nummer: employee.sv_nummer ?? '',
          steuer_id: employee.steuer_id ?? '',
          steuerklasse: employee.steuerklasse,
          iban: employee.iban ?? '',
          gross_salary: employee.gross_salary,
          start_date: employee.start_date,
          end_date: employee.end_date ?? null,
          notes: employee.notes ?? '',
          team: employee.team,
          profile_id: employee.profile_id,
          is_active: employee.is_active,
        }
      : EMPTY_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof EmployeePayload, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) {
      setError('Name ist erforderlich.')
      return
    }
    if (!form.start_date) {
      setError('Einstellungsdatum ist erforderlich.')
      return
    }
    setSaving(true)
    setError(null)
    const payload: EmployeePayload = {
      ...form,
      email: form.email || null,
      phone: form.phone || null,
      sv_nummer: form.sv_nummer || null,
      steuer_id: form.steuer_id || null,
      iban: form.iban || null,
      end_date: form.end_date || null,
      notes: form.notes || null,
      team: form.team || null,
      profile_id: form.profile_id || null,
    }
    const { error: err } = isEdit
      ? await updateEmployee(employee.id, payload)
      : await createEmployee(payload)
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gf-base/80 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-gf-card border border-gf-border bg-gf-card">
        <div className="flex items-center justify-between border-b border-gf-border px-5 py-4">
          <h2 className="font-sans text-sm font-medium text-gf-text">
            {isEdit ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}
          </h2>
          <button onClick={onClose} className="text-gf-text-muted transition-colors hover:text-gf-text" aria-label="Schließen">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <p className="rounded-gf-card border border-gf-accent/30 bg-gf-accent-light px-3 py-2 font-sans text-xs text-gf-accent">
              {error}
            </p>
          )}

          <div>
            <label className="mb-1 block font-mono text-xs text-gf-text-muted">NAME *</label>
            <input type="text" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Max Mustermann" className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text placeholder-gf-text-placeholder focus:border-gf-primary focus:outline-none" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-xs text-gf-text-muted">E-MAIL</label>
              <input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="max@firma.de" className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text placeholder-gf-text-placeholder focus:border-gf-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-gf-text-muted">TELEFON</label>
              <input type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+49 ..." className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text placeholder-gf-text-placeholder focus:border-gf-primary focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-xs text-gf-text-muted">TEAM</label>
              <select value={form.team ?? ''} onChange={(e) => set('team', (e.target.value || null) as TeamColorType | null)} className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text focus:border-gf-primary focus:outline-none">
                <option value="">— kein Team —</option>
                {TEAM_OPTIONS.map((team) => <option key={team} value={team}>{t('teamColor.' + team)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-gf-text-muted">{t('personnel.appUser')}</label>
              <select value={form.profile_id ?? ''} onChange={(e) => set('profile_id', e.target.value || null)} className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text focus:border-gf-primary focus:outline-none">
                <option value="">— kein App-Zugang —</option>
                {technicians.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}{profile.role === 'contractor' ? ' · ' + t('assignment.externalSuffix') : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-xs text-gf-text-muted">SV-NUMMER</label>
              <input type="text" value={form.sv_nummer ?? ''} onChange={(e) => set('sv_nummer', e.target.value)} placeholder="12 345678 A 001" className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-mono text-sm text-gf-text placeholder-gf-text-placeholder focus:border-gf-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-gf-text-muted">STEUER-ID</label>
              <input type="text" value={form.steuer_id ?? ''} onChange={(e) => set('steuer_id', e.target.value)} placeholder="12 345 678 901" className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-mono text-sm text-gf-text placeholder-gf-text-placeholder focus:border-gf-primary focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-xs text-gf-text-muted">STEUERKLASSE</label>
              <select value={form.steuerklasse ?? ''} onChange={(e) => set('steuerklasse', e.target.value || null)} className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text focus:border-gf-primary focus:outline-none">
                <option value="">— wählen —</option>
                {STEUERKLASSEN.map((sk) => <option key={sk} value={sk}>Klasse {sk}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-gf-text-muted">BRUTTOLOHN (€)</label>
              <input type="number" min={0} step={0.01} value={form.gross_salary} onChange={(e) => set('gross_salary', parseFloat(e.target.value) || 0)} className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-mono text-sm text-gf-text focus:border-gf-primary focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs text-gf-text-muted">IBAN</label>
            <input type="text" value={form.iban ?? ''} onChange={(e) => set('iban', e.target.value.toUpperCase())} placeholder="DE89 3704 0044 0532 0130 00" className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-mono text-sm text-gf-text placeholder-gf-text-placeholder focus:border-gf-primary focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-xs text-gf-text-muted">EINSTELLUNG *</label>
              <input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text focus:border-gf-primary focus:outline-none" required />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-gf-text-muted">AUSTRITT</label>
              <input type="date" value={form.end_date ?? ''} onChange={(e) => set('end_date', e.target.value || null)} className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text focus:border-gf-primary focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs text-gf-text-muted">NOTIZEN</label>
            <textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} rows={2} className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text placeholder-gf-text-placeholder focus:border-gf-primary focus:outline-none" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-gf-btn border border-gf-border px-4 py-2 font-sans text-sm text-gf-text-muted transition-colors hover:text-gf-text">Abbrechen</button>
            <button type="submit" disabled={saving} className="rounded-gf-btn bg-gf-primary px-4 py-2 font-sans text-sm text-gf-text-inverse transition-opacity disabled:opacity-50">{saving ? 'Speichern…' : 'Speichern'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface EmployeeRowProps {
  employee: Employee
  onEdit: (e: Employee) => void
  onDeactivate: (e: Employee) => void
  onPayroll: (e: Employee) => void
  onVacation: (e: Employee) => void
}

function EmployeeRow({ employee, onEdit, onDeactivate, onPayroll, onVacation }: EmployeeRowProps) {
  const [expanded, setExpanded] = useState(false)
  const salary = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(employee.gross_salary)

  return (
    <>
      <tr className="border-b border-gf-border transition-colors hover:bg-gf-base-light/40">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-gf-border"><UserRound size={13} strokeWidth={1.5} className="text-gf-text-muted" /></div>
            <div>
              <p className="font-sans text-sm text-gf-text">{employee.full_name}</p>
              {employee.email && <p className="font-mono text-xs text-gf-text-muted">{employee.email}</p>}
            </div>
          </div>
        </td>
        <td className="px-4 py-3"><TeamChip team={employee.team} /></td>
        <td className="px-4 py-3"><span className="font-mono text-xs text-gf-text-muted">{employee.steuerklasse ? 'Klasse ' + employee.steuerklasse : '—'}</span></td>
        <td className="px-4 py-3"><span className="font-mono text-sm text-gf-text">{salary}</span></td>
        <td className="px-4 py-3"><span className="font-mono text-xs text-gf-text-muted">{employee.start_date}</span></td>
        <td className="px-4 py-3">
          {employee.is_active ? <span className="rounded-full border border-gf-success/40 bg-gf-success/10 px-2 py-0.5 font-mono text-xs text-gf-success">AKTIV</span> : <span className="rounded-full border border-gf-border px-2 py-0.5 font-mono text-xs text-gf-text-muted">INAKTIV</span>}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setExpanded((x) => !x)} className="rounded p-1 text-gf-text-muted transition-colors hover:text-gf-text" title="Details">{expanded ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}</button>
            <button onClick={() => onVacation(employee)} className="rounded p-1 text-gf-text-muted transition-colors hover:text-gf-primary" title="Urlaubsverwaltung"><CalendarDays size={14} strokeWidth={1.5} /></button>
            <button onClick={() => onPayroll(employee)} className="rounded p-1 text-gf-text-muted transition-colors hover:text-gf-primary" title="Gehaltsabrechnung"><Receipt size={14} strokeWidth={1.5} /></button>
            <button onClick={() => onEdit(employee)} className="rounded p-1 text-gf-text-muted transition-colors hover:text-gf-primary" title="Bearbeiten"><Pencil size={14} strokeWidth={1.5} /></button>
            {employee.is_active && <button onClick={() => onDeactivate(employee)} className="rounded p-1 text-gf-text-muted transition-colors hover:text-gf-danger" title="Deaktivieren"><UserX size={14} strokeWidth={1.5} /></button>}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-gf-border bg-gf-base-light/20">
          <td colSpan={7} className="px-4 pb-3 pt-1">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 md:grid-cols-4">
              <Detail label="SV-NUMMER" value={employee.sv_nummer} />
              <Detail label="STEUER-ID" value={employee.steuer_id} />
              <Detail label="IBAN" value={employee.iban} mono />
              <Detail label="TELEFON" value={employee.phone} />
              <Detail label="APP-PROFIL" value={employee.profile_id} mono />
              {employee.end_date && <Detail label="AUSTRITT" value={employee.end_date} />}
              {employee.notes && <div className="col-span-2 md:col-span-4"><Detail label="NOTIZEN" value={employee.notes} /></div>}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null
  return <div><p className="font-mono text-[10px] text-gf-text-label">{label}</p><p className={(mono ? 'font-mono ' : 'font-sans ') + 'text-xs text-gf-text'}>{value}</p></div>
}

function ContractorRow({ contractor }: { contractor: TechnicianProfile }) {
  const { t } = useTranslation()
  return (
    <tr className="border-b border-gf-border transition-colors hover:bg-gf-base-light/40">
      <td className="px-4 py-3 font-sans text-sm text-gf-text">{contractor.full_name}</td>
      <td className="px-4 py-3"><TeamChip team={contractor.team} /></td>
      <td className="px-4 py-3"><span className="rounded-full border border-gf-success/40 bg-gf-success/10 px-2 py-0.5 font-mono text-xs text-gf-success">AKTIV</span></td>
      <td className="px-4 py-3 text-right"><Link to="/admin/personnel" className="font-sans text-xs text-gf-primary hover:underline">{t('personnel.manageInUsers')}</Link></td>
    </tr>
  )
}

export function PersonnelPage() {
  const { t } = useTranslation()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([])
  const [activeTab, setActiveTab] = useState<'internal' | 'external'>('internal')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [payrollEmployee, setPayrollEmployee] = useState<Employee | null>(null)
  const [vacationEmployee, setVacationEmployee] = useState<Employee | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [employeeResult, technicianResult] = await Promise.all([fetchEmployees(includeInactive), fetchTechnicians()])
    if (employeeResult.error) setError(employeeResult.error)
    if (technicianResult.error) setError(technicianResult.error)
    setEmployees(employeeResult.data)
    setTechnicians(technicianResult.data)
    setLoading(false)
  }, [includeInactive])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) => e.full_name.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q) || e.sv_nummer?.toLowerCase().includes(q))
  }, [employees, search])

  const filteredContractors = useMemo(() => {
    const contractors = technicians.filter((profile) => profile.role === 'contractor')
    const q = search.trim().toLowerCase()
    if (!q) return contractors
    return contractors.filter((profile) => profile.full_name.toLowerCase().includes(q))
  }, [technicians, search])

  const handleDeactivate = async (employee: Employee) => {
    if (!window.confirm('Mitarbeiter "' + employee.full_name + '" deaktivieren?')) return
    const { error: err } = await deactivateEmployee(employee.id)
    if (err) {
      setError(err)
      return
    }
    await load()
  }

  const handleSaved = async () => {
    setCreating(false)
    setEditing(null)
    await load()
  }

  const tabClass = (tab: 'internal' | 'external') =>
    activeTab === tab
      ? 'rounded-gf-btn border border-gf-primary bg-gf-primary/10 px-3 py-2 font-sans text-sm text-gf-primary transition-colors'
      : 'rounded-gf-btn border border-gf-border px-3 py-2 font-sans text-sm text-gf-text-muted transition-colors hover:text-gf-text'

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-gf-text-inverse">Mitarbeiter</h1>
          <p className="mt-0.5 font-sans text-xs text-gf-text-muted">Interne Angestellte — Gehaltsabrechnung &amp; Urlaubsverwaltung</p>
        </div>
        {activeTab === 'internal' && <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-gf-btn bg-gf-primary px-4 py-2 font-sans text-sm text-gf-text-inverse transition-opacity hover:opacity-90"><Plus size={14} strokeWidth={2} />Neuer Mitarbeiter</button>}
      </div>

      <div className="rounded-gf-card border border-gf-warning/30 bg-gf-warning/5 px-4 py-3"><p className="font-sans text-xs text-gf-warning">⚠ Gehaltsberechnungen müssen von Janet Martinez de Peglow validiert werden, bevor dieses Modul produktiv geht.</p></div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setActiveTab('internal')} className={tabClass('internal')}>{t('personnel.tabs.internal')}</button>
        <button type="button" onClick={() => setActiveTab('external')} className={tabClass('external')}>{t('personnel.tabs.external')}</button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-gf-text-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, E-Mail oder SV-Nummer suchen…" className="w-full rounded-gf-btn border border-gf-border bg-gf-surface py-2 pl-8 pr-3 font-sans text-sm text-gf-text placeholder-gf-text-placeholder focus:border-gf-primary focus:outline-none" />
        </div>
        {activeTab === 'internal' && <label className="flex cursor-pointer items-center gap-2 font-sans text-sm text-gf-text-muted"><input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="accent-gf-primary" />Inaktive anzeigen</label>}
      </div>

      {error && <p className="rounded-gf-card border border-gf-accent/30 bg-gf-accent-light px-4 py-3 font-sans text-sm text-gf-accent">{error}</p>}

      <div className="rounded-gf-card border border-gf-border">
        {loading ? <div className="flex items-center justify-center py-16"><div className="nx-loader" /></div> : activeTab === 'external' ? (
          filteredContractors.length === 0 ? <EmptyState text="Keine externen Contractor gefunden." /> : <ExternalTable contractors={filteredContractors} />
        ) : filteredEmployees.length === 0 ? <EmptyState text={search ? 'Keine Ergebnisse.' : 'Noch keine Mitarbeiter erfasst.'} /> : (
          <table className="w-full">
            <thead><tr className="border-b border-gf-border"><th className="px-4 py-3 text-left font-mono text-xs text-gf-text-label">MITARBEITER</th><th className="px-4 py-3 text-left font-mono text-xs text-gf-text-label">TEAM</th><th className="px-4 py-3 text-left font-mono text-xs text-gf-text-label">STEUERKLASSE</th><th className="px-4 py-3 text-left font-mono text-xs text-gf-text-label">BRUTTOGEHALT</th><th className="px-4 py-3 text-left font-mono text-xs text-gf-text-label">EINSTELLUNG</th><th className="px-4 py-3 text-left font-mono text-xs text-gf-text-label">STATUS</th><th className="px-4 py-3" /></tr></thead>
            <tbody>{filteredEmployees.map((e) => <EmployeeRow key={e.id} employee={e} onEdit={setEditing} onDeactivate={handleDeactivate} onPayroll={setPayrollEmployee} onVacation={setVacationEmployee} />)}</tbody>
          </table>
        )}
      </div>

      {!loading && activeTab === 'internal' && filteredEmployees.length > 0 && <p className="font-mono text-xs text-gf-text-muted">{filteredEmployees.length} Mitarbeiter{filteredEmployees.length !== employees.length ? ' (von ' + employees.length + ')' : ''}</p>}

      {(creating || editing) && <EmployeeModal employee={editing} technicians={technicians} onClose={() => { setCreating(false); setEditing(null) }} onSaved={handleSaved} />}
      {payrollEmployee && <PayrollSlipModal employee={payrollEmployee} onClose={() => setPayrollEmployee(null)} />}
      {vacationEmployee && <VacationModal employee={vacationEmployee} onClose={() => setVacationEmployee(null)} />}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex flex-col items-center gap-2 py-16 text-center"><UserRound size={32} strokeWidth={1} className="text-gf-text-muted" /><p className="font-sans text-sm text-gf-text-muted">{text}</p></div>
}

function ExternalTable({ contractors }: { contractors: TechnicianProfile[] }) {
  return (
    <table className="w-full">
      <thead><tr className="border-b border-gf-border"><th className="px-4 py-3 text-left font-mono text-xs text-gf-text-label">NAME</th><th className="px-4 py-3 text-left font-mono text-xs text-gf-text-label">TEAM</th><th className="px-4 py-3 text-left font-mono text-xs text-gf-text-label">STATUS</th><th className="px-4 py-3" /></tr></thead>
      <tbody>{contractors.map((profile) => <ContractorRow key={profile.id} contractor={profile} />)}</tbody>
    </table>
  )
}
