import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchWorkOrder,
  fetchTechnicians,
  assignWorkOrder,
} from '@/services/workOrderService'
import type { TeamColor } from '@/types/enums'

const TEAMS: { value: TeamColor; label: string; dot: string }[] = [
  { value: 'rot', label: 'Team Rot', dot: 'bg-team-rot' },
  { value: 'gruen', label: 'Team Grün', dot: 'bg-team-gruen' },
  { value: 'blau', label: 'Team Blau', dot: 'bg-team-blau' },
  { value: 'gelb', label: 'Team Gelb', dot: 'bg-team-gelb' },
]

const WORK_TYPE_LABELS: Record<string, string> = {
  soplado: 'Soplado',
  fusion_ap: 'Fusión AP',
  fusion_dp: 'Fusión DP',
  alta: 'Alta',
  nt_installation: 'NT-Installation',
  patchkabel: 'Patchkabel',
}

export function WorkOrderAssignPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order, setOrder] = useState<{
    order_number: string
    work_type: string
    address: string | null
    city: string | null
    clients: { name: string } | null
    projects: { code: string } | null
  } | null>(null)
  const [technicians, setTechnicians] = useState<
    { id: string; full_name: string; team: string | null }[]
  >([])
  const [selectedTeam, setSelectedTeam] = useState<TeamColor | ''>('')
  const [selectedTechnician, setSelectedTechnician] = useState<string>('')
  const [assignedDate, setAssignedDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([fetchWorkOrder(id), fetchTechnicians()]).then(
      ([{ data: orderData }, { data: techData }]) => {
        setOrder(orderData as typeof order)
        setTechnicians(techData)
        setIsLoading(false)
      },
    )
  }, [id])

  // Filter technicians by selected team
  const filteredTechnicians = selectedTeam
    ? technicians.filter((t) => t.team === selectedTeam)
    : technicians

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !user || !selectedTeam) return

    setIsSaving(true)
    setError(null)

    const { error } = await assignWorkOrder(
      id,
      selectedTeam,
      selectedTechnician || null,
      assignedDate || null,
      user.id,
    )

    if (error) {
      setError(error)
      setIsSaving(false)
    } else {
      navigate('/admin/orders')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gf-border border-t-gf-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/orders')}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gf-border text-gf-text-muted hover:border-gf-primary hover:text-gf-primary transition-colors"
        >
          ←
        </button>
        <div>
          <h2 className="font-display text-xl font-bold text-gf-text">Auftrag zuweisen</h2>
          {order && (
            <p className="text-sm text-gf-text-muted font-mono">{order.order_number}</p>
          )}
        </div>
      </div>

      {/* Order summary */}
      {order && (
        <div className="mb-5 rounded-xl border border-gf-border bg-gf-card p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gf-text-muted">Kunde</p>
              <p className="font-medium text-gf-text">{order.clients?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gf-text-muted">Projekt</p>
              <p className="font-medium text-gf-text">{order.projects?.code ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gf-text-muted">Arbeitstyp</p>
              <p className="font-medium text-gf-text">{WORK_TYPE_LABELS[order.work_type] ?? order.work_type}</p>
            </div>
            <div>
              <p className="text-xs text-gf-text-muted">Adresse</p>
              <p className="font-medium text-gf-text">
                {[order.address, order.city].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleAssign}>
        <div className="rounded-xl border border-gf-border bg-gf-card p-5 space-y-5">
          <h3 className="font-display text-sm font-semibold text-gf-text">Zuweisung</h3>

          {/* Team selection */}
          <div>
            <label className="mb-2 block text-xs font-medium text-gf-text-muted">
              Team <span className="text-gf-danger">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TEAMS.map((team) => (
                <button
                  key={team.value}
                  type="button"
                  onClick={() => { setSelectedTeam(team.value); setSelectedTechnician('') }}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                    selectedTeam === team.value
                      ? 'border-gf-primary bg-gf-primary/10 text-gf-primary'
                      : 'border-gf-border bg-gf-surface text-gf-text hover:border-gf-primary/50'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${team.dot}`} />
                  {team.label.replace('Team ', '')}
                </button>
              ))}
            </div>
          </div>

          {/* Technician */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gf-text-muted">
              Interner Mitarbeiter (optional)
            </label>
            <select
              value={selectedTechnician}
              onChange={(e) => setSelectedTechnician(e.target.value)}
              disabled={!selectedTeam}
              className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary disabled:opacity-50"
            >
              <option value="">— Mitarbeiter wählen —</option>
              {filteredTechnicians.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
            {selectedTeam && filteredTechnicians.length === 0 && (
              <p className="mt-1 text-xs text-gf-text-muted">
                Keine Mitarbeiter für dieses Team gefunden.
              </p>
            )}
          </div>

          {/* Assigned date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gf-text-muted">
              Einsatzdatum
            </label>
            <input
              type="date"
              value={assignedDate}
              onChange={(e) => setAssignedDate(e.target.value)}
              className="w-full rounded-lg border border-gf-border bg-gf-surface px-3 py-2 text-sm text-gf-text focus:border-gf-primary focus:outline-none focus:ring-1 focus:ring-gf-primary"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-gf-danger/30 bg-gf-danger/10 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate('/admin/orders')}
            className="flex-1 rounded-lg border border-gf-border px-4 py-2.5 text-sm font-medium text-gf-text hover:bg-gf-surface transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={!selectedTeam || isSaving}
            className="flex-1 rounded-lg bg-gf-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-gf-primary-dark disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Zuweisen…' : 'Zuweisen & Status → Assigned'}
          </button>
        </div>
      </form>
    </div>
  )
}
