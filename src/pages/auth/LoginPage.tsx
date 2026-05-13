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
    <div className="nx-auth-shell">
      <div className="nx-auth-grid">
        <section className="nx-auth-brief" aria-label="NEXUS operations">
          <div className="nx-brand-lockup">
            <div className="nx-brand-mark">
              <svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <rect x="6" y="6" width="6" height="28" fill="var(--color-fg-1)" />
                <rect x="28" y="6" width="6" height="28" fill="var(--color-fg-1)" />
                <path d="M12 8 L28 32 L28 26 L12 2 Z" fill="var(--color-accent)" />
              </svg>
            </div>
            <div>
              <div className="nx-brand-name">LUMEN<span className="text-accent">.OS</span></div>
              <div className="nx-brand-meta">NEXUS ENGINEERING OPERATIONS</div>
            </div>
          </div>

          <div>
            <p className="nx-label mb-3">ACCESS CONTROL</p>
            <h1 className="font-display text-4xl font-light leading-none text-fg-1">
              Field execution, certification and billing command.
            </h1>
          </div>

          <div className="nx-command-lines">
            <span><b>NE3</b><em>WORK ORDERS</em></span>
            <span><b>NE4</b><em>WORK MANAGER BRIDGE</em></span>
            <span><b>PIN</b><em>TECH / CONTRACTOR FIELD MODE</em></span>
          </div>
        </section>

        <div className="nx-auth-panel">
          <div className="mb-6 md:hidden">
            <div className="nx-brand-lockup">
              <div className="nx-brand-mark">
                <svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                  <rect x="6" y="6" width="6" height="28" fill="var(--color-fg-1)" />
                  <rect x="28" y="6" width="6" height="28" fill="var(--color-fg-1)" />
                  <path d="M12 8 L28 32 L28 26 L12 2 Z" fill="var(--color-accent)" />
                </svg>
              </div>
              <div>
                <div className="nx-brand-name">LUMEN<span className="text-accent">.OS</span></div>
                <div className="nx-brand-meta">NEXUS FIELD OPS</div>
              </div>
            </div>
          </div>

          <div className="mb-5">
            <p className="nx-label">AUTHENTICATION</p>
            <h2 className="mt-2 font-display text-2xl font-light text-fg-1">Secure entry</h2>
          </div>

          <div className="mb-5 grid grid-cols-2 border border-line-s bg-bg-0">
            <button
              type="button"
              onClick={() => { setMode('pin'); setError(null) }}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                mode === 'pin' ? 'bg-accent/10 text-accent' : 'text-fg-2 hover:bg-bg-2 hover:text-fg-1'
              }`}
            >
              <KeyRound size={15} strokeWidth={1.5} />
              {t('authPin.tabPin')}
            </button>
            <button
              type="button"
              onClick={() => { setMode('email'); setError(null) }}
              className={`flex items-center justify-center gap-2 border-l border-line-s px-3 py-2.5 text-sm transition-colors ${
                mode === 'email' ? 'bg-accent/10 text-accent' : 'text-fg-2 hover:bg-bg-2 hover:text-fg-1'
              }`}
            >
              <Mail size={15} strokeWidth={1.5} />
              {t('authPin.tabAdmin')}
            </button>
          </div>

          {error && (
            <div className="notice notice-err mb-4">
              {error}
            </div>
          )}

          {mode === 'pin' ? (
            <form onSubmit={handlePinLogin} className="space-y-4">
              <div className="input">
                <label htmlFor="login-code">
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
                  placeholder={t('authPin.loginCodePlaceholder')}
                />
              </div>
              <div className="input">
                <label htmlFor="pin">
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
                  className="text-center font-mono text-lg"
                  placeholder="••••"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-p w-full"
              >
                {isSubmitting ? t('auth.signingIn') : t('authPin.signIn')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="input">
                <label htmlFor="email">
                  {t('auth.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="name@nexus-engineering.de"
                />
              </div>
              <div className="input">
                <label htmlFor="password">
                  {t('auth.password')}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-p w-full"
              >
                {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
              </button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.FORGOT_PASSWORD)}
                className="nx-label w-full text-center transition-colors hover:text-accent"
              >
                {t('auth.forgotPassword')}
              </button>
            </form>
          )}

          <div className="mt-6 flex justify-center border-t border-line pt-5">
            <LanguageSelector />
          </div>
        </div>
      </div>
    </div>
  )
}
