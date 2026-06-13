import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/config/routes'
import {
  getSchedulerScope,
  createAppointment,
  type SchedulerScope,
} from '@/services/appointmentsService'

export function AppointmentNewPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [scope, setScope] = useState<SchedulerScope | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [scheduledAt, setScheduledAt] = useState('')
  const [durationMin, setDurationMin] = useState(60)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false
    async function load() {
      const { data, error: err } = await getSchedulerScope(userId)
      if (cancelled) return
      if (err || !data) setError(err ?? t('appointments.noScope'))
      else setScope(data)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user?.id, t])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!scope || !user) return
    if (!scheduledAt) {
      setError(t('appointments.fields.scheduledAtRequired'))
      return
    }
    setBusy(true)
    setError(null)
    const { data, error: err } = await createAppointment(
      {
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_min: durationMin,
        contact_name: contactName,
        contact_phone: contactPhone,
        address,
        notes,
      },
      scope,
      user.id,
    )
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    if (data) navigate(ROUTES.SCHEDULER.APPOINTMENTS_DETAIL.replace(':id', data.id))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link to={ROUTES.SCHEDULER.APPOINTMENTS} className="btn btn-g btn-sm">
          <ArrowLeft size={16} strokeWidth={1.5} />
          {t('appointments.actions.back')}
        </Link>
      </div>

      <div className="nx-page-header">
        <h2 className="nx-page-title">{t('appointments.newTitle')}</h2>
      </div>

      {error && (
        <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-l border border-line bg-bg-1 p-5">
        <FormField label={t('appointments.fields.scheduledAt')} htmlFor="scheduled-at" required>
          <input
            id="scheduled-at"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
            className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </FormField>

        <FormField label={t('appointments.fields.durationMin')} htmlFor="duration-min">
          <input
            id="duration-min"
            type="number"
            min={15}
            step={15}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </FormField>

        <FormField label={t('appointments.fields.contactName')} htmlFor="contact-name">
          <input
            id="contact-name"
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </FormField>

        <FormField label={t('appointments.fields.contactPhone')} htmlFor="contact-phone">
          <input
            id="contact-phone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </FormField>

        <FormField label={t('appointments.fields.address')} htmlFor="address">
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </FormField>

        <FormField label={t('appointments.fields.notes')} htmlFor="notes">
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </FormField>

        <div className="flex justify-end gap-2">
          <Link to={ROUTES.SCHEDULER.APPOINTMENTS} className="btn btn-g btn-sm">
            {t('appointments.actions.cancelForm')}
          </Link>
          <button type="submit" disabled={busy || !scope} className="btn btn-p btn-sm">
            {t('appointments.actions.create')}
          </button>
        </div>
      </form>
    </div>
  )
}

function FormField({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="nx-label mb-1 block">
        {label}
        {required && <span className="text-accent"> *</span>}
      </label>
      {children}
    </div>
  )
}
