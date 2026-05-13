import type { HTMLAttributes, ReactNode } from 'react'

type BadgeTone = 'neutral' | 'info' | 'ok' | 'warn' | 'err' | 'accent'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  tone?: BadgeTone
}

const toneClass: Record<BadgeTone, string> = {
  neutral: 'nx-badge-neutral',
  info: 'nx-badge-info',
  ok: 'nx-badge-ok',
  warn: 'nx-badge-warn',
  err: 'nx-badge-err',
  accent: 'nx-badge-accent',
}

export function Badge({ children, className = '', tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span className={['nx-badge', toneClass[tone], className].filter(Boolean).join(' ')} {...props}>
      {children}
    </span>
  )
}
