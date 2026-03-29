import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/config/routes'
import type { UserRole } from '@/types/enums'

const ROLE_ROUTES: Record<UserRole, string> = {
  admin: ROUTES.ADMIN.DASHBOARD,
  technician: ROUTES.TECHNICIAN.DASHBOARD,
  contractor: ROUTES.CONTRACTOR.DASHBOARD,
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { signInWithEmail, user } = useAuth()

  if (user) {
    navigate(ROLE_ROUTES[user.role])
    return null
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
    <div className="flex min-h-screen items-center justify-center bg-gf-base px-4">
      {/* Subtle cyan glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-80 w-125 -translate-x-1/2 rounded-full bg-gf-primary/8 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-gf-primary/20 bg-gf-base-light">
            <span className="font-display text-2xl font-bold text-gf-primary">L</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-gf-text-inverse">LUMEN</h1>
          <p className="mt-1 text-sm text-gf-text-muted">Nexus Engineering Operations</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-gf-border-dark bg-gf-base-light p-6 backdrop-blur-sm">
          {error && (
            <div className="mb-4 rounded-lg border border-gf-danger/20 bg-gf-danger/10 px-4 py-3 text-sm text-gf-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gf-text-label">
                E-Mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1 block w-full rounded-lg border border-gf-border-dark bg-gf-base px-3 py-2.5 text-sm text-gf-text-inverse placeholder-gf-text-placeholder transition-colors focus:border-gf-primary focus:ring-1 focus:ring-gf-primary focus:outline-none"
                placeholder="name@nexus-engineering.de"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gf-text-label">
                Passwort
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="mt-1 block w-full rounded-lg border border-gf-border-dark bg-gf-base px-3 py-2.5 text-sm text-gf-text-inverse placeholder-gf-text-placeholder transition-colors focus:border-gf-primary focus:ring-1 focus:ring-gf-primary focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-gf-primary px-4 py-2.5 text-sm font-semibold text-gf-base transition-colors hover:bg-gf-primary-light disabled:opacity-50"
            >
              {isSubmitting ? 'Anmeldung...' : 'Anmelden'}
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.FORGOT_PASSWORD)}
              className="w-full text-center text-xs text-gf-text-muted transition-colors hover:text-gf-primary"
            >
              Passwort vergessen?
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
