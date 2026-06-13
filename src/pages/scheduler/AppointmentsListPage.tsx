import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ManualCard } from '@/components/profile/ManualCard'
import { ROUTES } from '@/config/routes'
import {
  getSchedulerScope,
  listAppointments,
  type Appointment,
  type SchedulerScope,
} from '@/services/appointmentsService'
import { AppointmentStatusBadge } from '@/components/scheduler/AppointmentStatusBadge'

export function AppointmentsListPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [scope, setScope] = useState<SchedulerScope | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const { data: s, error: scopeErr } = await getSchedulerScope(userId)
        if (cancelled) return
        if (scopeErr || !s) {
          setError(scopeErr ?? t('appointments.noScope'))
          return
        }
        setScope(s)
        const { data, error: listErr } = await listAppointments(s)
        if (cancelled) return
        if (listErr) setError(listErr)
        else setAppointments(data)
      } catch {
        if (!cancelled) setError(t('appointments.loadError'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user?.id, t])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="nx-loader" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="nx-page-header">
        <div>
          <h2 className="nx-page-title">{t('appointments.pageTitle')}</h2>
          <p className="nx-label mt-2">
            {scope ? `${scope.line} · ${appointments[0]?.operators?.code ?? t('appointments.operator')}` : ''}
          </p>
        </div>
        <Link to={ROUTES.SCHEDULER.APPOINTMENTS_NEW} className="btn btn-p btn-sm">
          <Plus size={16} strokeWidth={1.5} />
          {t('appointments.actions.new')}
        </Link>
      </div>

      {error && (
        <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          {error}
        </div>
      )}

      <ManualCard />

      {appointments.length === 0 && !error ? (
        <div className="rounded-l border border-line bg-bg-1 py-16 text-center">
          <CalendarClock size={28} strokeWidth={1.5} className="mx-auto text-fg-3" />
          <p className="mt-2 text-sm font-medium text-fg-1">{t('appointments.emptyTitle')}</p>
          <p className="text-xs text-fg-2">{t('appointments.emptySubtitle')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((a) => (
            <Link
              key={a.id}
              to={ROUTES.SCHEDULER.APPOINTMENTS_DETAIL.replace(':id', a.id)}
              className="card-lift block rounded-l border border-line bg-bg-1 p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-accent">
                  {new Date(a.scheduled_at).toLocaleString(
                    i18n.language === 'es' ? 'es-ES' : 'de-DE',
                  )}
                </span>
                <AppointmentStatusBadge status={a.status} />
              </div>
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg-1">
                <span>{a.contact_name ?? t('appointments.noContact')}</span>
                <span className="text-xs text-fg-2">{a.line}</span>
              </div>
              {a.address && <p className="text-xs text-fg-2">{a.address}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
