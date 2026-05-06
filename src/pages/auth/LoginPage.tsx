import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { KeyRound, Mail } from 'lucide-react'
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
  const [mode, setMode] = useState<'pin' | 'email'>('pin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginCode, setLoginCode] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { signInWithEmail, signInWithPin, user } = useAuth()

  if (user) {
    return <Navigate to={ROLE_ROUTES[user.role]} replace />
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

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await signInWithPin(loginCode, pin)
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
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-l border border-accent/20 bg-bg-1">
            <span className="font-display text-2xl font-bold text-accent">L</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-fg-1">LUMEN</h1>
          <p className="mt-1 text-sm text-fg-2">Nexus Engineering Operations</p>
        </div>

        {/* Card */}
        <div className="rounded-l border border-line-s bg-bg-1 p-6">
          <div className="mb-5 grid grid-cols-2 border border-line-s">
            <button
              type="button"
              onClick={() => { setMode('pin'); setError(null) }}
              className={`flex items-center justify-center gap-2 px-3 py-2 text-sm transition-colors ${
                mode === 'pin' ? 'bg-bg-3 text-fg-1' : 'text-fg-2 hover:bg-bg-2 hover:text-fg-1'
              }`}
            >
              <KeyRound size={15} strokeWidth={1.5} />
              {t('authPin.tabPin')}
            </button>
            <button
              type="button"
              onClick={() => { setMode('email'); setError(null) }}
              className={`flex items-center justify-center gap-2 border-l border-line-s px-3 py-2 text-sm transition-colors ${
                mode === 'email' ? 'bg-bg-3 text-fg-1' : 'text-fg-2 hover:bg-bg-2 hover:text-fg-1'
              }`}
            >
              <Mail size={15} strokeWidth={1.5} />
              {t('authPin.tabAdmin')}
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-s border border-err/20 bg-err/10 px-4 py-3 text-sm text-err">
              {error}
            </div>
          )}

          {mode === 'pin' ? (
            <form onSubmit={handlePinLogin} className="space-y-4">
              <div>
                <label htmlFor="login-code" className="block text-sm font-medium text-fg-3">
                  {t('authPin.loginCode')}
                </label>
                <input
                  id="login-code"
                  type="text"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  required
                  autoCapitalize="none"
                  autoComplete="username"
                  className="mt-1 block w-full rounded-s border border-line-s bg-bg-2 px-3 py-2.5 text-sm text-fg-1 placeholder-fg-4 transition-colors focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                  placeholder={t('authPin.loginCodePlaceholder')}
                />
              </div>
              <div>
                <label htmlFor="pin" className="block text-sm font-medium text-fg-3">
                  {t('authPin.pin')}
                </label>
                <input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  minLength={4}
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  required
                  autoComplete="current-password"
                  className="mt-1 block w-full rounded-s border border-line-s bg-bg-2 px-3 py-2.5 text-center font-mono text-lg text-fg-1 placeholder-fg-4 transition-colors focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                  placeholder="••••"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-s bg-accent px-4 py-2.5 text-sm font-semibold text-fg-1 transition-colors hover:bg-accent disabled:opacity-50"
              >
                {isSubmitting ? t('auth.signingIn') : t('authPin.signIn')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-4">
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
                  className="mt-1 block w-full rounded-s border border-line-s bg-bg-2 px-3 py-2.5 text-sm text-fg-1 placeholder-fg-4 transition-colors focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
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
                  className="mt-1 block w-full rounded-s border border-line-s bg-bg-2 px-3 py-2.5 text-sm text-fg-1 placeholder-fg-4 transition-colors focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-s bg-accent px-4 py-2.5 text-sm font-semibold text-fg-1 transition-colors hover:bg-accent disabled:opacity-50"
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
          )}
        </div>

        {/* Language selector at bottom of login screen */}
        <div className="mt-6 flex justify-center">
          <LanguageSelector />
        </div>
      </div>
    </div>
  )
}
