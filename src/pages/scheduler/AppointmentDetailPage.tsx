import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { ROUTES } from '@/config/routes'
import {
  getAppointment,
  confirmAppointment,
  completeAppointment,
  cancelAppointment,
  rescheduleAppointment,
  canTransition,
  type Appointment,
} from '@/services/appointmentsService'
import { AppointmentStatusBadge } from '@/components/scheduler/AppointmentStatusBadge'

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

export function AppointmentDetailPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rescheduleAt, setRescheduleAt] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const { data, error: err } = await getAppointment(id!)
      if (cancelled) return
      if (err || !data) setError(err ?? t('appointments.notFound'))
      else {
        setAppointment(data)
        setRescheduleAt(toLocalInput(data.scheduled_at))
      }
      setIsLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id, t])

  async function run(action: () => Promise<{ data: Appointment | null; error: string | null }>) {
    setBusy(true)
    setError(null)
    const { data, error: err } = await action()
    if (err) setError(err)
    else if (data) setAppointment(data)
    setBusy(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="nx-loader" />
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="space-y-4">
        <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          {error ?? t('appointments.notFound')}
        </div>
        <Link to={ROUTES.SCHEDULER.APPOINTMENTS} className="btn btn-g btn-sm">
          <ArrowLeft size={16} strokeWidth={1.5} />
          {t('appointments.actions.back')}
        </Link>
      </div>
    )
  }

  const a = appointment

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link to={ROUTES.SCHEDULER.APPOINTMENTS} className="btn btn-g btn-sm">
          <ArrowLeft size={16} strokeWidth={1.5} />
          {t('appointments.actions.back')}
        </Link>
        <AppointmentStatusBadge status={a.status} />
      </div>

      <div className="rounded-l border border-line bg-bg-1 p-5">
        <h2 className="nx-page-title mb-4">
          {new Date(a.scheduled_at).toLocaleString(i18n.language === 'es' ? 'es-ES' : 'de-DE')}
        </h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('appointments.fields.line')} value={a.line} />
          <Field label={t('appointments.fields.operator')} value={a.operators?.code ?? '—'} />
          <Field label={t('appointments.fields.durationMin')} value={String(a.duration_min)} />
          <Field label={t('appointments.fields.contactName')} value={a.contact_name ?? '—'} />
          <Field label={t('appointments.fields.contactPhone')} value={a.contact_phone ?? '—'} />
          <Field label={t('appointments.fields.address')} value={a.address ?? '—'} />
          <Field label={t('appointments.fields.notes')} value={a.notes ?? '—'} />
        </dl>
      </div>

      {error && (
        <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          {error}
        </div>
      )}

      {(a.status === 'completed' || a.status === 'cancelled') ? (
        <p className="nx-label">{t('appointments.terminal')}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {canTransition(a.status, 'confirmed') && (
              <button
                disabled={busy}
                onClick={() => void run(() => confirmAppointment(a))}
                className="btn btn-p btn-sm"
              >
                {t('appointments.actions.confirm')}
              </button>
            )}
            {canTransition(a.status, 'completed') && (
              <button
                disabled={busy}
                onClick={() => void run(() => completeAppointment(a))}
                className="btn btn-s btn-sm"
              >
                {t('appointments.actions.complete')}
              </button>
            )}
            {canTransition(a.status, 'cancelled') && (
              <button
                disabled={busy}
                onClick={() => void run(() => cancelAppointment(a))}
                className="btn btn-danger btn-sm"
              >
                {t('appointments.actions.cancel')}
              </button>
            )}
          </div>

          {canTransition(a.status, 'rescheduled') && (
            <div className="rounded-l border border-line bg-bg-1 p-4">
              <label className="nx-label mb-2 block" htmlFor="reschedule-at">
                {t('appointments.actions.reschedule')}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="reschedule-at"
                  type="datetime-local"
                  value={rescheduleAt}
                  onChange={(e) => setRescheduleAt(e.target.value)}
                  className="rounded-s border border-line bg-bg-1 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  disabled={busy || !rescheduleAt}
                  onClick={() =>
                    void run(() =>
                      rescheduleAppointment(a, new Date(rescheduleAt).toISOString()),
                    )
                  }
                  className="btn btn-s btn-sm"
                >
                  {t('appointments.actions.reschedule')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        disabled={busy}
        onClick={() => navigate(ROUTES.SCHEDULER.APPOINTMENTS)}
        className="btn btn-g btn-sm"
      >
        {t('appointments.actions.back')}
      </button>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="nx-label">{label}</dt>
      <dd className="mt-1 text-sm text-fg-1">{value}</dd>
    </div>
  )
}
