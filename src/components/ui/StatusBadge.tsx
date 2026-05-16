import { useLabels } from '@/i18n/labels'
import { STATUS_COLORS } from '@/constants/styles'
import type { WorkOrderStatus } from '@/types/enums'

interface Props {
  status: WorkOrderStatus
  className?: string
}

export function StatusBadge({ status, className = '' }: Props) {
  const L = useLabels()
  return (
    <span
      className={`badge badge-dot ${STATUS_COLORS[status]} ${className}`}
    >
      {L.status(status)}
    </span>
  )
}
