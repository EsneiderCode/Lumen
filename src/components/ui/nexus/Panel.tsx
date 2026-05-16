import type { ReactNode } from 'react'

interface PanelProps {
  actions?: ReactNode
  children: ReactNode
  className?: string
  meta?: ReactNode
  padding?: 'none' | 'sm' | 'md'
  title?: ReactNode
}

const paddingClass = {
  none: '',
  sm: 'nx-panel-pad-sm',
  md: 'nx-panel-pad',
}

export function Panel({ actions, children, className = '', meta, padding = 'md', title }: PanelProps) {
  return (
    <section className={['nx-panel', className].filter(Boolean).join(' ')}>
      {title || meta || actions ? (
        <div className="nx-panel-head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {meta ? <p>{meta}</p> : null}
          </div>
          {actions ? <div className="nx-panel-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={paddingClass[padding]}>{children}</div>
    </section>
  )
}
