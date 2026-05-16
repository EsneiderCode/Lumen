import { forwardRef, type ButtonHTMLAttributes, type ElementType } from 'react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ElementType
  iconRight?: ElementType
  loading?: boolean
  size?: ButtonSize
  variant?: ButtonVariant
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'nx-btn-primary',
  secondary: 'nx-btn-secondary',
  ghost: 'nx-btn-ghost',
  danger: 'nx-btn-danger',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'nx-btn-sm',
  md: '',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      disabled,
      icon: Icon,
      iconRight: IconRight,
      loading = false,
      size = 'md',
      type = 'button',
      variant = 'secondary',
      ...props
    },
    ref,
  ) => {
    const iconSize = size === 'sm' ? 12 : 14

    return (
      <button
        ref={ref}
        className={['nx-btn', variantClass[variant], sizeClass[size], className].filter(Boolean).join(' ')}
        disabled={disabled || loading}
        type={type}
        {...props}
      >
        {loading ? <Loader2 className="nx-btn-spinner" size={iconSize} strokeWidth={1.5} /> : null}
        {!loading && Icon ? <Icon size={iconSize} strokeWidth={1.5} /> : null}
        {children ? <span>{children}</span> : null}
        {IconRight ? <IconRight size={iconSize} strokeWidth={1.5} /> : null}
      </button>
    )
  },
)

Button.displayName = 'Button'
