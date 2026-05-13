import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/config/routes'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await resetPassword(email)
      if (result.error) {
        setError(result.error)
      } else {
        setSent(true)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="nx-auth-shell">
      <div className="nx-auth-grid max-w-3xl">
        <section className="nx-auth-brief" aria-label="NEXUS recovery">
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
              <div className="nx-brand-meta">CREDENTIAL RECOVERY</div>
            </div>
          </div>
          <div className="nx-command-lines">
            <span><b>AUTH</b><em>RESET LINK</em></span>
            <span><b>MODE</b><em>ADMIN EMAIL</em></span>
            <span><b>STATUS</b><em>SECURE FLOW</em></span>
          </div>
        </section>

        <div className="nx-auth-panel">
          <div className="mb-6">
            <p className="nx-label">AUTHENTICATION</p>
            <h1 className="mt-2 font-display text-2xl font-light text-fg-1">
              Passwort zurücksetzen
            </h1>
            <p className="mt-2 text-sm text-fg-2">
              Geben Sie Ihre E-Mail-Adresse ein, um einen Link zum Zurücksetzen zu erhalten.
            </p>
          </div>

          {sent ? (
            <div className="space-y-4 text-center">
              <div className="notice notice-ok text-left">
                Falls ein Konto mit dieser E-Mail existiert, erhalten Sie in Kürze einen Link zum
                Zurücksetzen.
              </div>
              <Link
                to={ROUTES.LOGIN}
                className="btn btn-g"
              >
                Zurück zur Anmeldung
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="notice notice-err">
                  {error}
                </div>
              )}
              <div className="input">
                <label htmlFor="reset-email">
                  E-Mail
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="name@nexus-engineering.de"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-p w-full"
              >
                {isSubmitting ? 'Wird gesendet...' : 'Link senden'}
              </button>
              <Link
                to={ROUTES.LOGIN}
                className="nx-label block text-center transition-colors hover:text-accent"
              >
                Zurück zur Anmeldung
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
