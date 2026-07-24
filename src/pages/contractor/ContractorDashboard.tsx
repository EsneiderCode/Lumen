import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { fetchContractorWorkOrders } from '@/services/workOrderService'
import { fetchProfileCompliance } from '@/services/complianceService'
import type { ProfileComplianceResult } from '@/services/complianceService'
import { complianceLevel } from '@/components/compliance/aptitudeLevel'
import type { ComplianceLevel } from '@/components/compliance/aptitudeLevel'
import type { WorkOrderStatus } from '@/types/enums'
import { ROUTES } from '@/config/routes'

const ACTIVE_STATUSES: WorkOrderStatus[] = [
  'assigned', 'in_progress', 'executed', 'rueckmeldung_pending', 'rueckmeldung_sent',
]
const DONE_STATUSES: WorkOrderStatus[] = ['paid', 'invoiced', 'client_accepted']

const LEVEL_BADGE: Record<ComplianceLevel, string> = {
  green: 'badge-ok',
  yellow: 'badge-warn',
  red: 'badge-err',
}

export function ContractorDashboard() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [doneCount, setDoneCount] = useState<number | null>(null)
  const [compliance, setCompliance] = useState<ProfileComplianceResult | null>(null)
  const [complianceLoading, setComplianceLoading] = useState(true)

  const today = new Date().toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  useEffect(() => {
    if (!user) return
    fetchContractorWorkOrders(user.id, user.team ?? null).then(({ data }) => {
      setActiveCount(data.filter((o) => ACTIVE_STATUSES.includes(o.status as WorkOrderStatus)).length)
      setDoneCount(data.filter((o) => DONE_STATUSES.includes(o.status as WorkOrderStatus)).length)
    })
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    fetchProfileCompliance(user.id).then(({ data }) => {
      setCompliance(data)
      setComplianceLoading(false)
    })
  }, [user?.id])

  return (
    <div>
      {/* Greeting */}
      <div className="panel mb-5">
        <div className="pbody">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="nx-label mb-2">{t('compliance.portal.dashboardKicker')}</p>
            <h2 className="font-display text-lg font-semibold text-fg-1">
              {t('compliance.portal.welcome', { name: user?.fullName })}
            </h2>
            <p className="mt-0.5 text-sm text-fg-2">{today}</p>
          </div>
          <span className="badge badge-info">
            {t('compliance.portal.roleBadge')}
          </span>
        </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate(ROUTES.CONTRACTOR.ORDERS)}
          className="kpi text-left transition-colors hover:border-accent/50"
        >
          <div className="mb-2 h-1 w-8 rounded-full bg-accent" />
          <p className="font-display text-2xl font-bold text-fg-1">
            {activeCount === null ? '—' : activeCount}
          </p>
          <p className="nx-label mt-1">{t('compliance.portal.activeOrders')}</p>
        </button>
        <button
          onClick={() => navigate(ROUTES.CONTRACTOR.ORDERS)}
          className="kpi text-left transition-colors hover:border-ok/50"
        >
          <div className="mb-2 h-1 w-8 rounded-full bg-ok" />
          <p className="font-display text-2xl font-bold text-fg-1">
            {doneCount === null ? '—' : doneCount}
          </p>
          <p className="nx-label mt-1">{t('compliance.portal.settled')}</p>
        </button>
      </div>

      {/* Document status — real compliance summary from the module */}
      <div className="panel mb-4">
        <div className="phead">
          <h3 className="title">{t('compliance.portal.docStatusTitle')}</h3>
          <span className="m">{t('compliance.portal.paymentGate')}</span>
        </div>
        <div className="pbody">
          {complianceLoading ? (
            <p className="text-sm text-fg-3">[LOADING]</p>
          ) : !compliance?.hasEntity ? (
            <p className="text-sm text-fg-2">{t('compliance.portal.noEntity')}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`badge ${LEVEL_BADGE[complianceLevel(compliance)]}`}>
                  {t(`compliance.aptitude.${complianceLevel(compliance)}`)}
                </span>
                <span className="text-sm text-fg-2">
                  {compliance.missingCodes.length > 0
                    ? t('compliance.portal.openIssues', { count: compliance.missingCodes.length })
                    : t('compliance.portal.allValid')}
                </span>
              </div>
              <button
                onClick={() => navigate(ROUTES.CONTRACTOR.DOCUMENTS)}
                className="nx-card-button w-full border-line p-3 text-center"
              >
                <p className="text-sm font-semibold text-accent">
                  {t('compliance.portal.viewDocuments')}
                </p>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick link to orders */}
      <button
        onClick={() => navigate(ROUTES.CONTRACTOR.ORDERS)}
        className="nx-card-button border-accent/30 bg-accent/5 p-4 text-center"
      >
        <p className="text-sm font-semibold text-accent">{t('compliance.portal.viewAllOrders')}</p>
      </button>
    </div>
  )
}
