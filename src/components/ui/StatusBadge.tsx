import { STATUS_LABELS } from '@/constants/labels'
import { STATUS_COLORS } from '@/constants/styles'
import type { WorkOrderStatus } from '@/types/enums'

interface Props {
  status: WorkOrderStatus
  className?: string
}

export function StatusBadge({ status, className = '' }: Props) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]} ${className}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
