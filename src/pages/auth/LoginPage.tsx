import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { LanguageSelector } from '@/components/ui/LanguageSelector'
import { ROUTES } from '@/config/routes'
import type { UserRole } from '@/types/enums'

const ROLE_ROUTES: Record<UserRole, string> = {
  admin: ROUTES.ADMIN.DASHBOARD,
  technician: ROUTES.TECHNICIAN.DASHBOARD,
  contractor: ROUTES.CONTRACTOR.DASHBOARD,
}

type LoginMode = 'pin' | 'email'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { signInWithEmail, signInWithLoginCode, user } = useAuth()

  const [mode, setMode] = useState<LoginMode>('pin')

  const [loginCode, setLoginCode] = useState('')
  const [pin, setPin] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) {
    return <Navigate to={ROLE_ROUTES[user.role]} replace />
  }

  const switchMode = (next: LoginMode) => {
    setMode(next)
    setError(null)
    setLoginCode('')
    setPin('')
    setPassword('')
  }

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await signInWithLoginCode(loginCode, pin)
      if (result.error) {
        setError(result.error)
        setPin('')
      } else if (result.user) {
        navigate(ROLE_ROUTES[result.user.role])
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await signInWithEmail(email, password)
      if (result.error) {
        setError(result.error)
      } else if (result.user) {
        navigate(ROLE_ROUTES[result.user.role])
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const isPinSubmittable = loginCode.trim().length > 0 && /^\d{4,8}$/.test(pin)

  return (
    <div className="flex min-h-screen items-center justify-center nexus-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center border border-line bg-bg-1"
            aria-hidden="true"
          >
            <span className="font-display text-2xl font-bold text-accent">L</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-wide text-fg-1">LUMEN</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-fg-3">
            Nexus Engineering Operations
          </p>
        </div>

        {/* Mode toggle */}
        <div className="mb-4 flex border border-line bg-bg-1">
          <button
            type="button"
            onClick={() => switchMode('pin')}
            className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
              mode === 'pin' ? 'bg-accent text-ink' : 'text-fg-2 hover:text-fg-1'
            }`}
          >
            {t('auth.pin.tabLabel')}
          </button>
          <button
            type="button"
            onClick={() => switchMode('email')}
            className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
              mode === 'email' ? 'bg-accent text-ink' : 'text-fg-2 hover:text-fg-1'
            }`}
          >
            {t('auth.pin.emailTab')}
          </button>
        </div>

        {/* Card */}
        <div className="border border-line bg-bg-1 p-6">
          {error && (
            <div
              role="alert"
              className="mb-4 border border-err/30 bg-err/10 px-3 py-2 text-sm text-err"
            >
              {error}
            </div>
          )}

          {mode === 'pin' ? (
            <form onSubmit={handlePinLogin} className="space-y-4" noValidate>
              <div>
                <label htmlFor="loginCode" className="block text-xs font-medium uppercase tracking-wider text-fg-3">
                  Login-Code
                </label>
                <input
                  id="loginCode"
                  type="text"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  placeholder="z. B. tech01"
                  className="mt-2 block w-full border border-line-s bg-bg-2 px-3 py-2.5 text-sm text-fg-1 placeholder:text-fg-4 transition-colors focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="pin" className="block text-xs font-medium uppercase tracking-wider text-fg-3">
                  PIN
                </label>
                <input
                  id="pin"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="current-password"
                  maxLength={8}
                  placeholder="••••••"
                  className="mt-2 block w-full border border-line-s bg-bg-2 px-3 py-2.5 text-center font-mono text-base tracking-[0.4em] text-fg-1 placeholder:text-fg-4 transition-colors focus:border-accent focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !isPinSubmittable}
                className="w-full bg-accent px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-xs font-medium uppercase tracking-wider text-fg-3">
                  {t('auth.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="mt-2 block w-full border border-line-s bg-bg-2 px-3 py-2.5 text-sm text-fg-1 placeholder:text-fg-4 transition-colors focus:border-accent focus:outline-none"
                  placeholder="name@nexus-engineering.de"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-medium uppercase tracking-wider text-fg-3">
                  {t('auth.password')}
                </label>
                <div className="relative mt-2">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="block w-full border border-line-s bg-bg-2 px-3 py-2.5 pr-10 text-sm text-fg-1 placeholder:text-fg-4 transition-colors focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-fg-3 transition-colors hover:text-fg-1"
                  >
                    {showPassword
                      ? <EyeOff size={16} strokeWidth={1.5} aria-hidden="true" />
                      : <Eye size={16} strokeWidth={1.5} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-accent px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
              </button>

              <button
                type="button"
                onClick={() => navigate(ROUTES.FORGOT_PASSWORD)}
                className="w-full text-center text-xs text-fg-3 transition-colors hover:text-accent"
              >
                {t('auth.forgotPassword')}
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <LanguageSelector />
        </div>
      </div>
    </div>
  )
}
