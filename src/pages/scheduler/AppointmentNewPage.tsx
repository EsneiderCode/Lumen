import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/config/routes'
import {
  createAppointment,
  type AppointmentLine,
} from '@/services/appointmentsService'
import { fetchOperators } from '@/services/workOrderService'

const LINES: AppointmentLine[] = ['NE3', 'NE4']

export function AppointmentNewPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [operators, setOperators] = useState<{ id: string; code: string; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [line, setLine] = useState<AppointmentLine>('NE3')
  const [operatorId, setOperatorId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [durationMin, setDurationMin] = useState(60)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await fetchOperators()
      if (cancelled) return
      setOperators(data)
      if (data.length > 0) setOperatorId((current) => current || data[0].id)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!scheduledAt) {
      setError(t('appointments.fields.scheduledAtRequired'))
      return
    }
    if (!operatorId) {
      setError(t('appointments.fields.operatorRequired'))
      return
    }
    setBusy(true)
    setError(null)
    const { data, error: err } = await createAppointment(
      {
        line,
        operator_id: operatorId,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_min: durationMin,
        contact_name: contactName,
        contact_phone: contactPhone,
        address,
        notes,
      },
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
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('appointments.fields.line')} htmlFor="line" required>
            <select
              id="line"
              value={line}
              onChange={(e) => setLine(e.target.value as AppointmentLine)}
              className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {LINES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </FormField>

          <FormField label={t('appointments.fields.operator')} htmlFor="operator" required>
            <select
              id="operator"
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              required
              className="w-full rounded-s border border-line bg-bg-0 px-3 py-2 text-sm text-fg-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="" disabled>{t('appointments.fields.operatorPlaceholder')}</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>{op.code} · {op.name}</option>
              ))}
            </select>
          </FormField>
        </div>

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
          <button type="submit" disabled={busy || !operatorId} className="btn btn-p btn-sm">
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
