import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Delete } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

type Step = 'current' | 'new' | 'confirm'

export function TechSettingsPage() {
  const { t } = useTranslation()
  const { user, updatePin } = useAuth()

  const [step, setStep] = useState<Step>('current')
  const [currentPin, setCurrentPinValue] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const activePin = step === 'current' ? currentPin : step === 'new' ? newPin : confirmPin
  const setActivePin =
    step === 'current' ? setCurrentPinValue : step === 'new' ? setNewPin : setConfirmPin

  const handleNumpadKey = (key: string) => {
    if (key === '⌫') {
      setActivePin((p) => p.slice(0, -1))
      setError(null)
      return
    }
    if (activePin.length < 6) {
      setActivePin((p) => p + key)
      setError(null)
    }
  }

  const handleNext = () => {
    if (activePin.length !== 6) {
      setError(t('auth.pin.enter6Digits'))
      return
    }
    if (step === 'current') {
      setStep('new')
    } else if (step === 'new') {
      setStep('confirm')
    }
    setError(null)
  }

  const handleSave = async () => {
    if (confirmPin.length !== 6) {
      setError(t('auth.pin.enter6Digits'))
      return
    }
    if (newPin !== confirmPin) {
      setError(t('auth.pin.mismatch'))
      setConfirmPin('')
      return
    }
    setIsSaving(true)
    setError(null)
    const { error: err } = await updatePin(currentPin, newPin)
    setIsSaving(false)
    if (err) {
      setError(err)
      // If current PIN was wrong, reset back to the current step so user can retry
      if (err.toLowerCase().includes('aktuelle')) {
        setCurrentPinValue('')
        setNewPin('')
        setConfirmPin('')
        setStep('current')
      } else {
        setConfirmPin('')
      }
    } else {
      setSuccess(true)
      setCurrentPinValue('')
      setNewPin('')
      setConfirmPin('')
      setStep('current')
    }
  }

  const handleReset = () => {
    setStep('current')
    setCurrentPinValue('')
    setNewPin('')
    setConfirmPin('')
    setError(null)
    setSuccess(false)
  }

  const TEAM_COLOR_CLASS: Record<string, string> = {
    rot: 'bg-team-rot',
    gruen: 'bg-team-gruen',
    blau: 'bg-team-blau',
    gelb: 'bg-team-gelb',
  }
  const teamColorClass = user?.team ? TEAM_COLOR_CLASS[user.team] ?? 'bg-fg-2' : 'bg-fg-2'

  const stepLabel =
    step === 'current'
      ? t('auth.pin.enterCurrent', 'Aktuelle PIN eingeben')
      : step === 'new'
      ? t('auth.pin.enterNew')
      : t('auth.pin.reenterNew')

  const stepNumber = step === 'current' ? 1 : step === 'new' ? 2 : 3

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-2">
      <div>
        <h1 className="font-display text-xl font-bold text-fg-1">{t('auth.pin.settingsTitle')}</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${teamColorClass}`} />
          <span className="font-mono text-xs text-fg-2">{user?.fullName}</span>
        </div>
      </div>

      {success && (
        <div className="rounded-s border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          {t('auth.pin.changeSuccess')}
        </div>
      )}

      <div className="rounded-l border border-line bg-bg-1 p-5 space-y-5">
        {/* Step indicator (3 dots) */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1.5 w-8 transition-colors ${
                n < stepNumber ? 'bg-ok' : n === stepNumber ? 'bg-accent' : 'bg-line'
              }`}
            />
          ))}
        </div>

        {error && (
          <div role="alert" className="rounded-s border border-err/30 bg-err/10 px-3 py-2 text-sm text-err">
            {error}
          </div>
        )}

        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-fg-3">{stepLabel}</p>
          <div className="flex justify-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`h-10 w-10 rounded-s border font-mono text-lg font-bold flex items-center justify-center transition-colors ${
                  i < activePin.length
                    ? 'border-accent bg-accent/10 text-fg-1'
                    : 'border-line bg-bg-2 text-fg-4'
                }`}
              >
                {i < activePin.length ? '•' : ''}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {NUMPAD_KEYS.map((key, idx) => {
            if (key === '') return <div key={idx} />
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleNumpadKey(key)}
                disabled={isSaving}
                className={`flex h-12 items-center justify-center rounded-s border border-line bg-bg-2 font-mono text-base font-medium text-fg-1 transition-colors hover:border-accent hover:bg-accent/10 active:bg-accent/20 disabled:opacity-40 ${
                  key === '⌫' ? 'text-fg-2' : ''
                }`}
              >
                {key === '⌫' ? <Delete size={16} strokeWidth={1.5} /> : key}
              </button>
            )
          })}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 rounded-s border border-line px-4 py-2.5 text-sm font-medium text-fg-2 transition-colors hover:text-fg-1"
          >
            {step === 'current' ? t('common.cancel') : t('common.back')}
          </button>
          {step === 'confirm' ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || confirmPin.length !== 6}
              className="flex-1 rounded-s bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? t('common.saving') : t('auth.pin.savePIN')}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={activePin.length !== 6}
              className="flex-1 rounded-s bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {t('common.next')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
