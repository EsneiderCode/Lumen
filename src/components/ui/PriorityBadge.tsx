import { useLabels } from '@/i18n/labels'
import { PRIORITY_COLORS } from '@/constants/styles'

type Priority = 'normal' | 'alta' | 'urgente'

interface Props {
  priority: Priority
  className?: string
}

export function PriorityBadge({ priority, className = '' }: Props) {
  const L = useLabels()
  return (
    <span className={`text-xs font-medium ${PRIORITY_COLORS[priority]} ${className}`}>
      {L.priority(priority)}
    </span>
  )
}
