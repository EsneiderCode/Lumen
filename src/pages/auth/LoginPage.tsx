import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Delete } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { LanguageSelector } from '@/components/ui/LanguageSelector'
import { ROUTES } from '@/config/routes'
import { TeamColor } from '@/types/enums'
import type { UserRole } from '@/types/enums'

const ROLE_ROUTES: Record<UserRole, string> = {
  admin: ROUTES.ADMIN.DASHBOARD,
  technician: ROUTES.TECHNICIAN.DASHBOARD,
  contractor: ROUTES.CONTRACTOR.DASHBOARD,
}

const TEAMS: { value: TeamColor; label: string; colorClass: string }[] = [
  { value: TeamColor.ROT,   label: 'Rot',   colorClass: 'bg-team-rot' },
  { value: TeamColor.GRUEN, label: 'Grün',  colorClass: 'bg-team-gruen' },
  { value: TeamColor.BLAU,  label: 'Blau',  colorClass: 'bg-team-blau' },
  { value: TeamColor.GELB,  label: 'Gelb',  colorClass: 'bg-team-gelb' },
]

const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

type LoginMode = 'email' | 'pin'

export function LoginPage() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<LoginMode>('pin')

  // Email/password state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // PIN state
  const [selectedTeam, setSelectedTeam] = useState<TeamColor | null>(null)
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

  const handleNumpadKey = (key: string) => {
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1))
      setError(null)
      return
    }
    if (pin.length < 6) {
      setPin((p) => p + key)
      setError(null)
    }
  }

  const handlePinLogin = async () => {
    if (!selectedTeam) {
      setError(t('auth.pin.selectTeam'))
      return
    }
    if (pin.length !== 6) {
      setError(t('auth.pin.enter6Digits'))
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await signInWithPin(selectedTeam, pin)
      if (result.error) {
        setError(result.error)
        setPin('')
      } else if (result.user) {
        navigate(ROLE_ROUTES[result.user.role])
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchMode = (next: LoginMode) => {
    setMode(next)
    setError(null)
    setPin('')
    setSelectedTeam(null)
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

        {/* Mode toggle */}
        <div className="mb-4 flex rounded-l border border-line bg-bg-1 p-1">
          <button
            type="button"
            onClick={() => switchMode('pin')}
            className={`flex-1 rounded-s py-1.5 text-xs font-medium transition-colors ${
              mode === 'pin' ? 'bg-accent text-ink' : 'text-fg-2 hover:text-fg-1'
            }`}
          >
            {t('auth.pin.tabLabel')}
          </button>
          <button
            type="button"
            onClick={() => switchMode('email')}
            className={`flex-1 rounded-s py-1.5 text-xs font-medium transition-colors ${
              mode === 'email' ? 'bg-accent text-ink' : 'text-fg-2 hover:text-fg-1'
            }`}
          >
            {t('auth.pin.emailTab')}
          </button>
        </div>

        {/* Card */}
        <div className="rounded-l border border-line bg-bg-1 p-6">
          {error && (
            <div role="alert" className="mb-4 rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
              {error}
            </div>
          )}

          {mode === 'pin' ? (
            <div className="space-y-5">
              {/* Team selector */}
              <div>
                <p className="mb-2 text-xs font-medium text-fg-3">{t('auth.pin.selectTeamLabel')}</p>
                <div className="grid grid-cols-4 gap-2">
                  {TEAMS.map((team) => (
                    <button
                      key={team.value}
                      type="button"
                      onClick={() => { setSelectedTeam(team.value); setError(null) }}
                      className={`flex flex-col items-center gap-1.5 rounded-s border py-3 transition-colors ${
                        selectedTeam === team.value
                          ? 'border-accent bg-accent/10'
                          : 'border-line bg-bg-2 hover:border-line-s'
                      }`}
                    >
                      <span className={`h-3 w-3 rounded-full ${team.colorClass}`} />
                      <span className="font-mono text-xs text-fg-1">{team.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* PIN display */}
              <div>
                <p className="mb-2 text-xs font-medium text-fg-3">{t('auth.pin.pinLabel')}</p>
                <div className="flex justify-center gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-10 w-10 rounded-s border font-mono text-lg font-bold transition-colors flex items-center justify-center ${
                        i < pin.length
                          ? 'border-accent bg-accent/10 text-fg-1'
                          : 'border-line bg-bg-2 text-fg-4'
                      }`}
                    >
                      {i < pin.length ? '•' : ''}
                    </div>
                  ))}
                </div>
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2">
                {NUMPAD_KEYS.map((key, idx) => {
                  if (key === '') return <div key={idx} />
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleNumpadKey(key)}
                      disabled={isSubmitting}
                      className={`flex h-12 items-center justify-center rounded-s border border-line bg-bg-2 font-mono text-base font-medium text-fg-1 transition-colors hover:border-accent hover:bg-accent/10 active:bg-accent/20 disabled:opacity-40 ${
                        key === '⌫' ? 'text-fg-2' : ''
                      }`}
                    >
                      {key === '⌫' ? <Delete size={16} strokeWidth={1.5} /> : key}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={handlePinLogin}
                disabled={isSubmitting || pin.length !== 6 || !selectedTeam}
                className="w-full rounded-s bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
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
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <LanguageSelector />
        </div>
      </div>
    </div>
  )
}
