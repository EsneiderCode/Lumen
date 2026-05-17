import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchWorkOrder,
  fetchTechnicians,
  assignWorkOrder,
} from '@/services/workOrderService'
import { notifyTaskAssigned } from '@/services/notificationService'
import type { TeamColor, WorkType } from '@/types/enums'
import { useLabels } from '@/i18n/labels'
import { TEAMS } from '@/constants/styles'

export function WorkOrderAssignPage() {
  const L = useLabels()
  const { t } = useTranslation()
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
    { id: string; full_name: string; team: string | null; role?: string }[]
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
    if (!id || !user || !selectedTechnician) return

    setIsSaving(true)
    setError(null)

    const { error } = await assignWorkOrder(
      id,
      selectedTeam || null,
      selectedTechnician || null,
      assignedDate || null,
      user.id,
    )

    if (error) {
      setError(error)
      setIsSaving(false)
    } else {
      const assigneeName =
        technicians.find((t) => t.id === selectedTechnician)?.full_name ?? selectedTechnician
      if (order)
        void notifyTaskAssigned(order.order_number, assigneeName, user.email ?? undefined)
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
              {t('workOrder.team')}
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TEAMS.map((team) => (
                <button
                  key={team.value}
                  type="button"
                  onClick={() => { setSelectedTeam(team.value); setSelectedTechnician('') }}
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

          {/* Technician */}
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-2">
              {t('assignment.assignee')} <span className="text-err">*</span>
            </label>
            <select
              value={selectedTechnician}
              onChange={(e) => setSelectedTechnician(e.target.value)}
              className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
            >
              <option value="">{t('assignment.chooseProfile')}</option>
              {filteredTechnicians.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name}{profile.role === 'contractor' ? ` · ${t('nav.contractor')}` : ''}
                </option>
              ))}
            </select>
            {selectedTeam && filteredTechnicians.length === 0 && (
              <p className="mt-1 text-xs text-fg-2">
                {t('assignment.noAssigneesForTeam')}
              </p>
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
        </div>

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
            disabled={!selectedTechnician || isSaving}
            className="flex-1 rounded-s bg-accent px-4 py-2.5 text-sm font-semibold text-ink hover:bg-accent disabled:opacity-50 transition-colors"
          >
            {isSaving ? t('assignment.assigning') : t('assignment.assignSubmit')}
          </button>
        </div>
      </form>
    </div>
  )
}
