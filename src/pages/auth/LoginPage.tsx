import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Delete, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { LanguageSelector } from '@/components/ui/LanguageSelector'
import { ROUTES } from '@/config/routes'
import { getLandingRoute } from '@/config/permissions'
import type { TeamMember } from '@/context/authTypes'

const TEAM_LABEL: Record<string, string> = {
  rot: 'Equipo Rot',
  gruen: 'Equipo Grün',
  blau: 'Equipo Blau',
  gelb: 'Equipo Gelb',
}

const TEAM_DOT: Record<string, string> = {
  rot: 'bg-team-rot',
  gruen: 'bg-team-gruen',
  blau: 'bg-team-blau',
  gelb: 'bg-team-gelb',
}

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const

type LoginMode = 'pin' | 'admin'
type PinStep = 'enter' | 'pick'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { signInWithEmail, getTeamByPin, signInWithTeamPin, user, permissions } = useAuth()

  const [mode, setMode] = useState<LoginMode>('pin')

  // ── PIN flow state ─────────────────────────────────────────────────────────
  const [pinStep, setPinStep] = useState<PinStep>('enter')
  const [pin, setPin] = useState('')
  const [team, setTeam] = useState<string | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)

  // ── Admin flow state ───────────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const switchMode = (next: LoginMode) => {
    setMode(next)
    setError(null)
    setPin('')
    setPinStep('enter')
    setTeam(null)
    setMembers([])
    setPassword('')
  }

  // ── Numpad handler ─────────────────────────────────────────────────────────
  const handleNumpad = (key: string) => {
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

  // ── Step 1: validate PIN and load team members ─────────────────────────────
  const handlePinSubmit = async () => {
    if (pin.length !== 6) return
    setLoadingTeam(true)
    setError(null)
    const result = await getTeamByPin(pin)
    setLoadingTeam(false)
    if (result.error) {
      setError(result.error)
      setPin('')
      return
    }
    setTeam(result.team)
    setMembers(result.members)
    setPinStep('pick')
  }

  // ── Keyboard input for PIN ─────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'pin' || pinStep !== 'enter' || loadingTeam) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) handleNumpad(e.key)
      else if (e.key === 'Backspace') handleNumpad('⌫')
      else if (e.key === 'Enter' && pin.length === 6) void handlePinSubmit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, pinStep, pin, loadingTeam])

  // ── Step 2: pick member and sign in ───────────────────────────────────────
  const handleMemberSelect = async (profileId: string) => {
    setIsSubmitting(true)
    setError(null)
    const result = await signInWithTeamPin(pin, profileId)
    setIsSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.user) {
      navigate(result.landingRoute ?? ROUTES.LOGIN)
    }
  }

  const handleBackToPin = () => {
    setPinStep('enter')
    setPin('')
    setTeam(null)
    setMembers([])
    setError(null)
  }

  // ── Admin email/password ───────────────────────────────────────────────────
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const result = await signInWithEmail(email, password)
    setIsSubmitting(false)
    if (result.error) {
      setError(result.error)
    } else if (result.user) {
      navigate(result.landingRoute ?? ROUTES.LOGIN)
    }
  }

  if (user) {
    const landing = getLandingRoute(permissions)
    if (landing !== ROUTES.LOGIN) return <Navigate to={landing} replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center nexus-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center border border-line bg-bg-1"
            aria-hidden="true"
          >
            <span className="font-display text-2xl font-bold text-accent">L</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-wide text-fg-1">LUMEN</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-fg-3">
            Nexus Engineering Operations
          </p>
        </div>

        {/* Mode toggle */}
        <div className="mb-4 flex border border-line bg-bg-1">
          <button
            type="button"
            onClick={() => switchMode('pin')}
            className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
              mode === 'pin' ? 'bg-accent text-ink' : 'text-fg-2 hover:text-fg-1'
            }`}
          >
            PIN
          </button>
          <button
            type="button"
            onClick={() => switchMode('admin')}
            className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
              mode === 'admin' ? 'bg-accent text-ink' : 'text-fg-2 hover:text-fg-1'
            }`}
          >
            Admin
          </button>
        </div>

        {/* Card */}
        <div className="border border-line bg-bg-1 p-6">
          {error && (
            <div
              role="alert"
              className="mb-4 border border-err/30 bg-err/10 px-3 py-2 text-sm text-err"
            >
              {error}
            </div>
          )}

          {mode === 'pin' ? (
            pinStep === 'enter' ? (
              /* ── Step 1: PIN numpad ──────────────────────────────────────── */
              <div className="space-y-5">
                <p className="text-center text-xs font-medium uppercase tracking-wider text-fg-3">
                  Team-PIN eingeben
                </p>

                {/* PIN dots */}
                <div className="flex justify-center gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-10 w-10 border flex items-center justify-center font-mono text-lg font-bold transition-colors ${
                        i < pin.length
                          ? 'border-accent bg-accent/10 text-fg-1'
                          : 'border-line bg-bg-2 text-fg-4'
                      }`}
                    >
                      {i < pin.length ? '•' : ''}
                    </div>
                  ))}
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2">
                  {NUMPAD_KEYS.map((key, idx) => {
                    if (key === '') return <div key={idx} />
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleNumpad(key)}
                        disabled={loadingTeam}
                        className={`flex h-12 items-center justify-center border border-line bg-bg-2 font-mono text-base font-medium text-fg-1 transition-colors hover:border-accent hover:bg-accent/10 active:bg-accent/20 disabled:opacity-40 ${
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
                  onClick={handlePinSubmit}
                  disabled={pin.length !== 6 || loadingTeam}
                  className="w-full bg-accent px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {loadingTeam ? 'Prüfen…' : 'Weiter'}
                </button>
              </div>
            ) : (
              /* ── Step 2: team member picker ──────────────────────────────── */
              <div className="space-y-4">
                {/* Team header */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBackToPin}
                    className="text-fg-3 transition-colors hover:text-fg-1"
                    aria-label="Zurück"
                  >
                    <ChevronLeft size={16} strokeWidth={1.5} />
                  </button>
                  <div className="flex items-center gap-2">
                    {team && (
                      <span className={`h-2.5 w-2.5 rounded-full ${TEAM_DOT[team] ?? 'bg-fg-3'}`} />
                    )}
                    <span className="font-mono text-xs uppercase tracking-wider text-fg-3">
                      {team ? TEAM_LABEL[team] ?? team : '—'}
                    </span>
                  </div>
                </div>

                <p className="text-xs font-medium uppercase tracking-wider text-fg-3">
                  Wer bist du?
                </p>

                {members.length === 0 ? (
                  <p className="py-4 text-center text-sm text-fg-3">
                    Keine aktiven Mitglieder in diesem Team.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleMemberSelect(m.id)}
                        disabled={isSubmitting}
                        className="flex w-full items-center justify-between border border-line bg-bg-2 px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent/5 disabled:opacity-40"
                      >
                        <span className="font-sans text-sm text-fg-1">{m.fullName}</span>
                        <span className="font-mono text-xs text-fg-4 uppercase">
                          {m.role === 'contractor' ? 'Subcontrata' : 'Mitarbeiter'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : (
            /* ── Admin: email + password ─────────────────────────────────── */
            <form onSubmit={handleAdminLogin} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-xs font-medium uppercase tracking-wider text-fg-3">
                  {t('auth.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="mt-2 block w-full border border-line-s bg-bg-2 px-3 py-2.5 text-sm text-fg-1 placeholder:text-fg-4 transition-colors focus:border-accent focus:outline-none"
                  placeholder="admin@nexus-engineering.de"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-medium uppercase tracking-wider text-fg-3">
                  {t('auth.password')}
                </label>
                <div className="relative mt-2">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="block w-full border border-line-s bg-bg-2 px-3 py-2.5 pr-10 text-sm text-fg-1 placeholder:text-fg-4 transition-colors focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-fg-3 transition-colors hover:text-fg-1"
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
                className="w-full bg-accent px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
              </button>

              <button
                type="button"
                onClick={() => navigate(ROUTES.FORGOT_PASSWORD)}
                className="w-full text-center text-xs text-fg-3 transition-colors hover:text-accent"
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
