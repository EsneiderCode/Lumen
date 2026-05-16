import type { ElementType, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

type AlertTone = 'neutral' | 'info' | 'ok' | 'warn' | 'err'

interface AlertProps {
  actions?: ReactNode
  children?: ReactNode
  className?: string
  icon?: ElementType
  title: ReactNode
  tone?: AlertTone
}

const toneClass: Record<AlertTone, string> = {
  neutral: '',
  info: 'nx-alert-info',
  ok: 'nx-alert-ok',
  warn: 'nx-alert-warn',
  err: 'nx-alert-err',
}

export function Alert({ actions, children, className = '', icon: Icon = AlertCircle, title, tone = 'neutral' }: AlertProps) {
  return (
    <div className={['nx-alert', toneClass[tone], className].filter(Boolean).join(' ')}>
      <Icon size={16} strokeWidth={1.5} />
      <div className="nx-alert-body">
        <strong>{title}</strong>
        {children ? <span>{children}</span> : null}
      </div>
      {actions ? <div className="nx-alert-actions">{actions}</div> : null}
    </div>
  )
}
