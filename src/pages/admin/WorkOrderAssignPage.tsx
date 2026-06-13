import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import {
  assignWorkOrder,
  fetchTechnicians,
  fetchWorkOrder,
  type TechnicianProfile,
} from '@/services/workOrderService'
import { fetchContractorDocuments } from '@/services/contractorDocumentService'
import {
  buildPersonAssignmentFailureReasons,
  type WorkOrderActionReason,
} from '@/services/workOrderBusinessRules'
import { notifyTaskAssigned } from '@/services/notificationService'
import type { TeamColor, WorkType } from '@/types/enums'
import { useLabels } from '@/i18n/labels'
import { TEAMS } from '@/constants/styles'

type AssignableOrder = {
  order_number: string
  work_type: string
  address: string | null
  city: string | null
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

  const [order, setOrder] = useState<AssignableOrder | null>(null)
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([])
  const [selectedTeam, setSelectedTeam] = useState<TeamColor | ''>('')
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [assignedDate, setAssignedDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  )
  const [assignmentReasons, setAssignmentReasons] = useState<WorkOrderActionReason[]>([])
  const [isCheckingDocuments, setIsCheckingDocuments] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const availableTechnicians = useMemo(() => {
    if (!selectedTeam) return []
    return technicians.filter((profile) => profile.team === selectedTeam)
  }, [selectedTeam, technicians])

  const selectedPerson = useMemo(
    () => availableTechnicians.find((profile) => profile.id === selectedTechnicianId) ?? null,
    [availableTechnicians, selectedTechnicianId],
  )

  useEffect(() => {
    let cancelled = false

    async function checkContractorDocuments(person: TechnicianProfile) {
      setIsCheckingDocuments(true)
      setAssignmentReasons([])
      const { data, error: documentError } = await fetchContractorDocuments(person.id)
      if (cancelled) return

      if (documentError) {
        setError(null)
        setAssignmentReasons([{ code: 'server_error', message: documentError }])
      } else {
        setError(null)
        setAssignmentReasons(
          buildPersonAssignmentFailureReasons(person, data, assignedDate || null),
        )
      }
      setIsCheckingDocuments(false)
    }

    if (!selectedPerson || selectedPerson.role !== 'contractor') {
      return () => {
        cancelled = true
      }
    }

    void checkContractorDocuments(selectedPerson)
    return () => {
      cancelled = true
    }
  }, [assignedDate, selectedPerson])

  function handleTeamSelect(team: TeamColor) {
    setSelectedTeam(team)
    setSelectedTechnicianId('')
    setAssignmentReasons([])
    setIsCheckingDocuments(false)
  }

  function handleTechnicianSelect(profileId: string) {
    const person = availableTechnicians.find((profile) => profile.id === profileId)
    setSelectedTechnicianId(profileId)
    if (!person || person.role !== 'contractor') {
      setAssignmentReasons([])
      setIsCheckingDocuments(false)
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !user || !selectedTeam || assignmentReasons.length > 0 || isCheckingDocuments) return

    setIsSaving(true)
    setError(null)

    const { error } = await assignWorkOrder(
      id,
      selectedTeam,
      assignedDate || null,
      user.id,
      selectedTechnicianId || null,
    )

    if (error) {
      setError(error)
      setIsSaving(false)
    } else {
      if (order) {
        const teamLabel = TEAMS.find((t) => t.value === selectedTeam)?.label ?? selectedTeam
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
          <h2 className="font-display text-xl font-bold text-fg-1">{t('assignment.title')}</h2>
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
        </div>
      )}

      <form onSubmit={handleAssign}>
        <div className="rounded-l border border-line bg-bg-1 p-5 space-y-5">
          <h3 className="font-display text-sm font-semibold text-fg-1">{t('assignment.section')}</h3>

          {/* Team selection */}
          <div>
            <label className="mb-2 block text-xs font-medium text-fg-2">
              {t('workOrder.team')} <span className="text-err">*</span>
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

          {selectedTeam && (
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-2">
                {t('assignment.technicianOptional')}
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
                    {profile.role === 'contractor' ? ` · ${t('assignment.externalSuffix')}` : ''}
                  </option>
                ))}
              </select>
              {availableTechnicians.length === 0 && (
                <p className="mt-2 text-xs text-fg-2">{t('assignment.noAssigneesForTeam')}</p>
              )}
            </div>
          )}

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
        </div>

        {isCheckingDocuments && (
          <div className="mt-4 rounded-s border border-line bg-bg-1 px-4 py-3 text-sm text-fg-2">
            {t('assignment.documentCheck')}
          </div>
        )}

        {assignmentReasons.length > 0 && (
          <div className="mt-4 rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
            <ul className="list-disc space-y-1 pl-4">
              {assignmentReasons.map((reason) => (
                <li key={reason.requirementId ?? reason.documentType ?? reason.code}>
                  {reason.message}
                </li>
              ))}
            </ul>
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
            disabled={!selectedTeam || isSaving || isCheckingDocuments || assignmentReasons.length > 0}
            className="flex-1 rounded-s bg-accent px-4 py-2.5 text-sm font-semibold text-ink hover:bg-accent disabled:opacity-50 transition-colors"
          >
            {isSaving ? t('assignment.assigning') : t('assignment.assignSubmit')}
          </button>
        </div>
      </form>
    </div>
  )
}
