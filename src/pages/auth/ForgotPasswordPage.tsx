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
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-80 w-125 -translate-x-1/2 rounded-full bg-accent/8 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-card-lg border border-accent/20 bg-bg-1">
            <span className="font-display text-2xl font-bold text-accent">L</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Passwort zurücksetzen
          </h1>
          <p className="mt-1 text-sm text-fg-2">
            Geben Sie Ihre E-Mail-Adresse ein, um einen Link zum Zurücksetzen zu erhalten.
          </p>
        </div>

        <div className="rounded-card border border-line-s bg-bg-1 p-6">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ok/10">
                <svg
                  className="h-6 w-6 text-ok"
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
              <p className="text-sm text-fg-2">
                Falls ein Konto mit dieser E-Mail existiert, erhalten Sie in Kürze einen Link zum
                Zurücksetzen.
              </p>
              <Link
                to={ROUTES.LOGIN}
                className="inline-block text-sm font-medium text-accent hover:text-accent"
              >
                Zurück zur Anmeldung
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-btn border border-err/20 bg-err/10 px-4 py-3 text-sm text-err">
                  {error}
                </div>
              )}
              <div>
                <label
                  htmlFor="reset-email"
                  className="block text-sm font-medium text-fg-3"
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
                  className="mt-1 block w-full rounded-btn border border-line-s bg-paper px-3 py-2.5 text-sm text-ink placeholder-fg-4 transition-colors focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                  placeholder="name@nexus-engineering.de"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-accent disabled:opacity-50"
              >
                {isSubmitting ? 'Wird gesendet...' : 'Link senden'}
              </button>
              <Link
                to={ROUTES.LOGIN}
                className="block text-center text-xs text-fg-2 transition-colors hover:text-accent"
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
