import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { authService } from '@/services/authService'

export function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }

    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await authService.updatePassword(password)
      if (result.error) {
        setError(result.error)
      } else {
        navigate(ROUTES.LOGIN)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center nexus-bg px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-80 w-125 -translate-x-1/2 rounded-full bg-accent/8 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-l border border-accent/20 bg-bg-1">
            <span className="font-display text-2xl font-bold text-accent">L</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-fg-1">Neues Passwort</h1>
          <p className="mt-1 text-sm text-fg-2">Geben Sie Ihr neues Passwort ein.</p>
        </div>

        <div className="rounded-l border border-line-s bg-bg-1 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-s border border-err/20 bg-err/10 px-4 py-3 text-sm text-err">
                {error}
              </div>
            )}
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-fg-3"
              >
                Neues Passwort
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1 block w-full rounded-s border border-line-s bg-bg-2 px-3 py-2.5 text-sm text-fg-1 placeholder-fg-4 transition-colors focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-fg-3"
              >
                Passwort bestätigen
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1 block w-full rounded-s border border-line-s bg-bg-2 px-3 py-2.5 text-sm text-fg-1 placeholder-fg-4 transition-colors focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-s bg-accent px-4 py-2.5 text-sm font-semibold text-fg-1 transition-colors hover:bg-accent disabled:opacity-50"
            >
              {isSubmitting ? 'Wird gespeichert...' : 'Passwort speichern'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
