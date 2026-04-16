import { PRIORITY_LABELS } from '@/constants/labels'
import { PRIORITY_COLORS } from '@/constants/styles'

type Priority = 'normal' | 'alta' | 'urgente'

interface Props {
  priority: Priority
  className?: string
}

export function PriorityBadge({ priority, className = '' }: Props) {
  return (
    <span className={`text-xs font-medium ${PRIORITY_COLORS[priority]} ${className}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  )
}
