import type { ElementType, KeyboardEvent, ReactNode } from 'react'

type KPITone = 'neutral' | 'accent' | 'ok' | 'warn' | 'err'

interface KPIProps {
  className?: string
  delta?: ReactNode
  icon?: ElementType
  label: ReactNode
  onClick?: () => void
  tone?: KPITone
  value: ReactNode
}

interface KPIGridProps {
  children: ReactNode
  className?: string
  columns?: 2 | 3 | 4
}

const toneClass: Record<KPITone, string> = {
  neutral: '',
  accent: 'nx-kpi-accent',
  ok: 'nx-kpi-ok',
  warn: 'nx-kpi-warn',
  err: 'nx-kpi-err',
}

export function KPI({ className = '', delta, icon: Icon, label, onClick, tone = 'neutral', value }: KPIProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={['nx-kpi-cell', toneClass[tone], onClick ? 'nx-kpi-clickable' : '', className]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="nx-kpi-label">
        {Icon ? <Icon size={14} strokeWidth={1.5} /> : null}
        <span>{label}</span>
      </div>
      <div className="nx-kpi-value">{value}</div>
      {delta ? <div className="nx-kpi-delta">{delta}</div> : null}
    </div>
  )
}

export function KPIGrid({ children, className = '', columns = 4 }: KPIGridProps) {
  return (
    <div className={['nx-kpi-grid', `nx-kpi-grid-${columns}`, className].filter(Boolean).join(' ')}>{children}</div>
  )
}
