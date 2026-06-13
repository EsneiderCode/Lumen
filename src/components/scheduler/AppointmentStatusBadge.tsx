import { useTranslation } from 'react-i18next'
import type { AppointmentStatus } from '@/services/appointmentsService'

const STATUS_BADGE: Record<AppointmentStatus, string> = {
  proposed: 'badge-neutral',
  confirmed: 'badge-info',
  rescheduled: 'badge-warn',
  completed: 'badge-ok',
  cancelled: 'badge-err',
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`badge badge-dot ${STATUS_BADGE[status]}`}>
      {t(`appointments.status.${status}`)}
    </span>
  )
}
