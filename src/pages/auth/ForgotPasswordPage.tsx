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
    <div className="flex min-h-screen items-center justify-center bg-gf-base px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-80 w-125 -translate-x-1/2 rounded-full bg-gf-primary/8 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-gf-primary/20 bg-gf-base-light">
            <span className="font-display text-2xl font-bold text-gf-primary">L</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-gf-text-inverse">
            Passwort zurücksetzen
          </h1>
          <p className="mt-1 text-sm text-gf-text-muted">
            Geben Sie Ihre E-Mail-Adresse ein, um einen Link zum Zurücksetzen zu erhalten.
          </p>
        </div>

        <div className="rounded-xl border border-gf-border-dark bg-gf-base-light p-6 backdrop-blur-sm">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gf-success/10">
                <svg
                  className="h-6 w-6 text-gf-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-sm text-gf-text-muted">
                Falls ein Konto mit dieser E-Mail existiert, erhalten Sie in Kürze einen Link zum
                Zurücksetzen.
              </p>
              <Link
                to={ROUTES.LOGIN}
                className="inline-block text-sm font-medium text-gf-primary hover:text-gf-primary-light"
              >
                Zurück zur Anmeldung
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-gf-danger/20 bg-gf-danger/10 px-4 py-3 text-sm text-gf-danger">
                  {error}
                </div>
              )}
              <div>
                <label
                  htmlFor="reset-email"
                  className="block text-sm font-medium text-gf-text-label"
                >
                  E-Mail
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="mt-1 block w-full rounded-lg border border-gf-border-dark bg-gf-base px-3 py-2.5 text-sm text-gf-text-inverse placeholder-gf-text-placeholder transition-colors focus:border-gf-primary focus:ring-1 focus:ring-gf-primary focus:outline-none"
                  placeholder="name@nexus-engineering.de"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-gf-primary px-4 py-2.5 text-sm font-semibold text-gf-base transition-colors hover:bg-gf-primary-light disabled:opacity-50"
              >
                {isSubmitting ? 'Wird gesendet...' : 'Link senden'}
              </button>
              <Link
                to={ROUTES.LOGIN}
                className="block text-center text-xs text-gf-text-muted transition-colors hover:text-gf-primary"
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
