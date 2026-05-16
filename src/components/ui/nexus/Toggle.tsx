import type { InputHTMLAttributes } from 'react'

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export function Toggle({ className = '', label, ...props }: ToggleProps) {
  return (
    <label className={['nx-toggle-wrap', className].filter(Boolean).join(' ')}>
      <input className="nx-toggle-input" type="checkbox" {...props} />
      <span className="nx-toggle" aria-hidden="true" />
      {label ? <span className="nx-toggle-label">{label}</span> : null}
    </label>
  )
}
