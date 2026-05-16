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
    <div className="nx-auth-shell">
      <div className="nx-auth-grid max-w-3xl">
        <section className="nx-auth-brief" aria-label="NEXUS password reset">
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
              <div className="nx-brand-meta">CREDENTIAL RESET</div>
            </div>
          </div>
          <div className="nx-command-lines">
            <span><b>AUTH</b><em>NEW PASSWORD</em></span>
            <span><b>POLICY</b><em>8 CHAR MINIMUM</em></span>
            <span><b>STATUS</b><em>SECURE FLOW</em></span>
          </div>
        </section>

        <div className="nx-auth-panel">
          <div className="mb-6">
            <p className="nx-label">AUTHENTICATION</p>
            <h1 className="mt-2 font-display text-2xl font-light text-fg-1">Neues Passwort</h1>
            <p className="mt-2 text-sm text-fg-2">Geben Sie Ihr neues Passwort ein.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="notice notice-err">
                {error}
              </div>
            )}
            <div className="input">
              <label htmlFor="new-password">
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
              />
            </div>
            <div className="input">
              <label htmlFor="confirm-password">
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
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-p w-full"
            >
              {isSubmitting ? 'Wird gespeichert...' : 'Passwort speichern'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
