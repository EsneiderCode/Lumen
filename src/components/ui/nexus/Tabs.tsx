import type { ReactNode } from 'react'

export interface TabItem<T extends string> {
  disabled?: boolean
  label: ReactNode
  meta?: ReactNode
  value: T
}

interface TabsProps<T extends string> {
  className?: string
  items: TabItem<T>[]
  onChange: (value: T) => void
  value: T
}

export function Tabs<T extends string>({ className = '', items, onChange, value }: TabsProps<T>) {
  return (
    <div className={['nx-tabs', className].filter(Boolean).join(' ')}>
      {items.map((item) => (
        <button
          aria-pressed={item.value === value}
          className={['nx-tab', item.value === value ? 'nx-tab-active' : ''].filter(Boolean).join(' ')}
          disabled={item.disabled}
          key={item.value}
          onClick={() => onChange(item.value)}
          type="button"
        >
          <span>{item.label}</span>
          {item.meta ? <small>{item.meta}</small> : null}
        </button>
      ))}
    </div>
  )
}
