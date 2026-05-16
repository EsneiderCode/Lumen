import type { ElementType, ReactNode } from 'react'
import { CircleDashed } from 'lucide-react'

interface EmptyStateProps {
  action?: ReactNode
  className?: string
  description?: ReactNode
  icon?: ElementType
  title: ReactNode
}

export function EmptyState({ action, className = '', description, icon: Icon = CircleDashed, title }: EmptyStateProps) {
  return (
    <div className={['nx-empty-state', className].filter(Boolean).join(' ')}>
      <Icon size={18} strokeWidth={1.5} />
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  )
}
