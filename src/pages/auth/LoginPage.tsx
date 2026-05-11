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

export function LoginPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { signInWithEmail, user } = useAuth()

  if (user) {
    return <Navigate to={ROLE_ROUTES[user.role]} replace />
  }

  const handleLogin = async (e: React.FormEvent) => {
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

  return (
    <div className="flex min-h-screen items-center justify-center nexus-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-l border border-line bg-bg-1">
            <span className="font-display text-2xl font-bold text-accent" aria-hidden="true">L</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-fg-1">LUMEN</h1>
          <p className="mt-1 text-sm text-fg-2">Nexus Engineering Operations</p>
        </div>

        {/* Card */}
        <div className="rounded-l border border-line bg-bg-1 p-6">
          {error && (
            <div role="alert" id="login-error" className="mb-4 rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" aria-describedby={error ? 'login-error' : undefined} noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-fg-3">
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                aria-invalid={!!error}
                className="mt-1 block w-full rounded-s border border-line-s bg-bg-2 px-3 py-2.5 text-sm text-fg-1 placeholder:text-fg-4 transition-colors focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                placeholder="name@nexus-engineering.de"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-fg-3">
                {t('auth.password')}
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  aria-invalid={!!error}
                  className="block w-full rounded-s border border-line-s bg-bg-2 px-3 py-2.5 pr-10 text-sm text-fg-1 placeholder:text-fg-4 transition-colors focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-fg-3 hover:text-fg-1 transition-colors"
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
              className="w-full rounded-s bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.FORGOT_PASSWORD)}
              className="w-full text-center text-xs text-fg-2 transition-colors hover:text-accent"
            >
              {t('auth.forgotPassword')}
            </button>
          </form>
        </div>

        {/* Language selector at bottom of login screen */}
        <div className="mt-6 flex justify-center">
          <LanguageSelector />
        </div>
      </div>
    </div>
  )
}
