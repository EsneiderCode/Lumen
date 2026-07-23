import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import {
  assignWorkOrder,
  fetchTechnicians,
  fetchWorkOrder,
  type TechnicianProfile,
} from '@/services/workOrderService'
import { fetchProfileCompliance, type ProfileComplianceResult } from '@/services/complianceService'
import { notifyTaskAssigned } from '@/services/notificationService'
import type { TeamColor, WorkType } from '@/types/enums'
import { useLabels } from '@/i18n/labels'
import { TEAMS } from '@/constants/styles'

type AssignableOrder = {
  order_number: string
  work_type: string
  address: string | null
  city: string | null
  project_id: string | null
  assigned_team: string | null
  assigned_technician: string | null
  assigned_date: string | null
  clients: { name: string } | null
  projects: { code: string } | null
  assignedProfile?: { full_name: string } | null
}

export function WorkOrderAssignPage() {
  const L = useLabels()
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { can } = usePermissions()
  const canOverride = can('compliance.override_assignment')

  const [order, setOrder] = useState<AssignableOrder | null>(null)
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([])
  const [selectedTeam, setSelectedTeam] = useState<TeamColor | ''>('')
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [assignedDate, setAssignedDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  )
  const [compliance, setCompliance] = useState<ProfileComplianceResult | null>(null)
  const [isCheckingDocuments, setIsCheckingDocuments] = useState(false)
  const [overrideEnabled, setOverrideEnabled] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [reassignmentNote, setReassignmentNote] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isReassignment = !!(order?.assigned_team || order?.assigned_technician)

  const currentTechnicianName =
    order?.assignedProfile?.full_name ??
    (order?.assigned_technician
      ? technicians.find((profile) => profile.id === order.assigned_technician)?.full_name
      : undefined)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setIsLoading(true)
      const [orderResult, technicianResult] = await Promise.all([
        fetchWorkOrder(id!),
        fetchTechnicians(),
      ])
      if (cancelled) return

      setOrder(orderResult.data as AssignableOrder | null)
      setTechnicians(technicianResult.data)
      setError(orderResult.error ?? technicianResult.error)
      setIsLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  // No team selected → any technician can be assigned directly.
  // Team selected → narrow the list to that team's members.
  const availableTechnicians = useMemo(() => {
    if (!selectedTeam) return technicians
    return technicians.filter((profile) => profile.team === selectedTeam)
  }, [selectedTeam, technicians])

  const selectedPerson = useMemo(
    () => availableTechnicians.find((profile) => profile.id === selectedTechnicianId) ?? null,
    [availableTechnicians, selectedTechnicianId],
  )

  useEffect(() => {
    let cancelled = false

    async function checkCompliance(person: TechnicianProfile) {
      setIsCheckingDocuments(true)
      setCompliance(null)
      setOverrideEnabled(false)
      setOverrideReason('')
      const { data } = await fetchProfileCompliance(person.id, order?.project_id ?? null)
      if (cancelled) return
      setError(null)
      setCompliance(data)
      setIsCheckingDocuments(false)
    }

    if (!selectedPerson || selectedPerson.role !== 'contractor') {
      return () => {
        cancelled = true
      }
    }

    void checkCompliance(selectedPerson)
    return () => {
      cancelled = true
    }
  }, [selectedPerson, order?.project_id])

  function handleTeamSelect(team: TeamColor) {
    // Clicking the selected team again deselects it (team is optional now).
    const next = selectedTeam === team ? '' : team
    setSelectedTeam(next)
    // Keep the chosen technician if they remain selectable; otherwise reset.
    const keepsTechnician =
      !selectedTechnicianId ||
      technicians.some(
        (profile) => profile.id === selectedTechnicianId && (next === '' || profile.team === next),
      )
    if (!keepsTechnician) {
      setSelectedTechnicianId('')
      setCompliance(null)
      setOverrideEnabled(false)
      setOverrideReason('')
      setIsCheckingDocuments(false)
    }
  }

  function handleTechnicianSelect(profileId: string) {
    const person = availableTechnicians.find((profile) => profile.id === profileId)
    setSelectedTechnicianId(profileId)
    if (!person || person.role !== 'contractor') {
      setCompliance(null)
      setOverrideEnabled(false)
      setOverrideReason('')
      setIsCheckingDocuments(false)
    }
  }

  // A blocked contractor can still be assigned when a permitted admin supplies a
  // justified override; that mirrors the DB gate in migration 047.
  const overrideActive = Boolean(
    canOverride && compliance?.isBlocked && overrideEnabled && overrideReason.trim(),
  )
  const effectiveBlocked = Boolean(compliance?.isBlocked) && !overrideActive

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    // At least one target is required: a team, a specific technician, or both.
    if (!id || !user || (!selectedTeam && !selectedTechnicianId) || effectiveBlocked || isCheckingDocuments) return

    setIsSaving(true)
    setError(null)

    const { error } = await assignWorkOrder(
      id,
      selectedTeam || null,
      assignedDate || null,
      user.id,
      selectedTechnicianId || null,
      isReassignment && reassignmentNote.trim() ? reassignmentNote.trim() : null,
      overrideActive ? { reason: overrideReason.trim(), by: user.id } : null,
    )

    if (error) {
      setError(error)
      setIsSaving(false)
    } else {
      if (order) {
        const teamLabel = selectedTeam
          ? TEAMS.find((t) => t.value === selectedTeam)?.label ?? selectedTeam
          : undefined
        const techName = selectedPerson?.full_name
        const prevTeamLabel = order.assigned_team
          ? TEAMS.find((t) => t.value === order.assigned_team)?.label ?? order.assigned_team
          : undefined
        const prevTechName = order.assigned_technician
          ? technicians.find((t) => t.id === order.assigned_technician)?.full_name
          : undefined
        const location = [order.address, order.city].filter(Boolean).join(', ') || undefined
        void notifyTaskAssigned({
          orderNumber: order.order_number,
          teamName: teamLabel,
          technicianName: techName,
          previousTeam: prevTeamLabel,
          previousTechnician: prevTechName,
          workType: L.workType(order.work_type as WorkType),
          assignedDate: assignedDate || undefined,
          address: location,
          orderUrl: `${window.location.origin}/admin/orders/${id}`,
          reassignmentNote: isReassignment && reassignmentNote.trim() ? reassignmentNote.trim() : undefined,
          orderId: id,
        })
      }
      navigate('/admin/orders')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="nx-loader" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/orders')}
          className="flex h-8 w-8 items-center justify-center rounded-s border border-line text-fg-2 hover:border-accent hover:text-accent transition-colors"
        >
          ←
        </button>
        <div>
          <h2 className="font-display text-xl font-bold text-fg-1">{isReassignment ? t('assignment.reassignTitle') : t('assignment.title')}</h2>
          {order && (
            <p className="text-sm text-fg-2 font-mono">{order.order_number}</p>
          )}
        </div>
      </div>

      {/* Order summary */}
      {order && (
        <div className="mb-5 rounded-l border border-line bg-bg-1 p-4">
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
              <p className="text-xs text-fg-2">{t('assignment.workType')}</p>
              <p className="font-medium text-fg-1">{L.workType(order.work_type as WorkType) || order.work_type}</p>
            </div>
            <div>
              <p className="text-xs text-fg-2">{t('workOrder.address')}</p>
              <p className="font-medium text-fg-1">
                {[order.address, order.city].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
          </div>

          {isReassignment && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-xs font-medium text-fg-2 mb-1">{t('assignment.currentAssignment')}</p>
              <div className="flex items-center gap-2 text-sm text-fg-1">
                <span className={`h-2 w-2 rounded-full ${TEAMS.find((t) => t.value === order.assigned_team)?.dot ?? 'bg-fg-3'}`} />
                {order.assigned_team && (
                  <span className="font-medium">
                    {TEAMS.find((t) => t.value === order.assigned_team)?.label ?? order.assigned_team}
                  </span>
                )}
                {currentTechnicianName && (
                  <span className={order.assigned_team ? 'text-fg-2' : 'font-medium'}>
                    {order.assigned_team ? '· ' : ''}{currentTechnicianName}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleAssign}>
        <div className="rounded-l border border-line bg-bg-1 p-5 space-y-5">
          <div>
            <h3 className="font-display text-sm font-semibold text-fg-1">{t('assignment.section')}</h3>
            <p className="mt-0.5 text-xs text-fg-2">{t('assignment.targetHint')}</p>
          </div>

          {/* Team selection (optional — a direct technician assignment is also valid) */}
          <div>
            <label className="mb-2 block text-xs font-medium text-fg-2">
              {t('assignment.teamOptional')}
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TEAMS.map((team) => (
                <button
                  key={team.value}
                  type="button"
                  onClick={() => handleTeamSelect(team.value)}
                  className={`flex items-center gap-2 rounded-s border px-3 py-2.5 text-sm font-medium transition-all ${
                    selectedTeam === team.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line bg-bg-0 text-fg-1 hover:border-accent/50'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${team.dot}`} />
                  {team.label.replace('Team ', '')}
                </button>
              ))}
            </div>
          </div>

          {/* Technician selection — always available; without a team it lists
              every active technician/contractor for a direct assignment. */}
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-2">
              {selectedTeam ? t('assignment.technicianOptional') : t('assignment.technicianDirect')}
            </label>
            <select
              value={selectedTechnicianId}
              onChange={(e) => handleTechnicianSelect(e.target.value)}
              className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">{t('assignment.chooseProfile')}</option>
              {availableTechnicians.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name}
                  {!selectedTeam && profile.team ? ` · ${TEAMS.find((tm) => tm.value === profile.team)?.label ?? profile.team}` : ''}
                  {profile.role === 'contractor' ? ` · ${t('assignment.externalSuffix')}` : ''}
                </option>
              ))}
            </select>
            {selectedTeam && availableTechnicians.length === 0 && (
              <p className="mt-2 text-xs text-fg-2">{t('assignment.noAssigneesForTeam')}</p>
            )}
          </div>

          {/* Assigned date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-2">
              {t('workOrder.deploymentDate')}
            </label>
            <input
              type="date"
              value={assignedDate}
              onChange={(e) => setAssignedDate(e.target.value)}
              className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {isReassignment && (
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-2">
                {t('assignment.reassignNote')}
              </label>
              <textarea
                value={reassignmentNote}
                onChange={(e) => setReassignmentNote(e.target.value)}
                placeholder={t('assignment.reassignNotePlaceholder')}
                rows={3}
                className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              />
            </div>
          )}
        </div>

        {isCheckingDocuments && (
          <div className="mt-4 rounded-s border border-line bg-bg-1 px-4 py-3 text-sm text-fg-2">
            {t('assignment.documentCheck')}
          </div>
        )}

        {compliance?.isBlocked && (
          <div className="mt-4 rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
            {!compliance.hasEntity ? (
              <p>{t('assignment.noComplianceRecord')}</p>
            ) : (
              <>
                <p className="mb-1">{t('assignment.complianceBlocked')}</p>
                {compliance.missingCodes.length > 0 && (
                  <ul className="list-disc space-y-1 pl-4">
                    {compliance.missingCodes.map((code) => (
                      <li key={code}>{t(`compliance.codes.${code}`, { defaultValue: code })}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        {compliance?.isBlocked && canOverride && (
          <div className="mt-3 rounded-s border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-fg-1">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={overrideEnabled}
                onChange={(e) => setOverrideEnabled(e.target.checked)}
                className="mt-0.5 accent-accent"
              />
              <span>
                <span className="font-medium text-warn">{t('assignment.overrideLabel')}</span>
                <span className="mt-0.5 block text-xs text-fg-3">{t('assignment.overrideHint')}</span>
              </span>
            </label>
            {overrideEnabled && (
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={2}
                placeholder={t('assignment.overrideReasonPlaceholder')}
                className="mt-2 w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none"
              />
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate('/admin/orders')}
            className="flex-1 rounded-s border border-line px-4 py-2.5 text-sm font-medium text-fg-1 hover:bg-bg-0 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={(!selectedTeam && !selectedTechnicianId) || isSaving || isCheckingDocuments || effectiveBlocked}
            className="flex-1 rounded-s bg-accent px-4 py-2.5 text-sm font-semibold text-ink hover:bg-accent disabled:opacity-50 transition-colors"
          >
            {isSaving ? t('assignment.assigning') : overrideActive ? t('assignment.overrideSubmit') : isReassignment ? t('assignment.reassignSubmit') : t('assignment.assignSubmit')}
          </button>
        </div>
      </form>
    </div>
  )
}
