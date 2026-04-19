import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
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
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      {/* Subtle cyan glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-80 w-125 -translate-x-1/2 rounded-full bg-accent/8 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-card-lg border border-accent/20 bg-bg-1">
            <span className="font-display text-2xl font-bold text-accent">L</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">LUMEN</h1>
          <p className="mt-1 text-sm text-fg-2">Nexus Engineering Operations</p>
        </div>

        {/* Card */}
        <div className="rounded-card border border-line-s bg-bg-1 p-6">
          {error && (
            <div className="mb-4 rounded-btn border border-err/20 bg-err/10 px-4 py-3 text-sm text-err">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
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
                className="mt-1 block w-full rounded-btn border border-line-s bg-paper px-3 py-2.5 text-sm text-ink placeholder-fg-4 transition-colors focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                placeholder="name@nexus-engineering.de"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-fg-3">
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="mt-1 block w-full rounded-btn border border-line-s bg-paper px-3 py-2.5 text-sm text-ink placeholder-fg-4 transition-colors focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-accent disabled:opacity-50"
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
