import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Delete } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

type Step = 'new' | 'confirm'

export function TechSettingsPage() {
  const { t } = useTranslation()
  const { user, updatePin } = useAuth()

  const [step, setStep] = useState<Step>('new')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const currentPin = step === 'new' ? newPin : confirmPin
  const setCurrentPin = step === 'new' ? setNewPin : setConfirmPin

  const handleNumpadKey = (key: string) => {
    if (key === '⌫') {
      setCurrentPin((p) => p.slice(0, -1))
      setError(null)
      return
    }
    if (currentPin.length < 6) {
      setCurrentPin((p) => p + key)
      setError(null)
    }
  }

  const handleNext = () => {
    if (newPin.length !== 6) {
      setError(t('auth.pin.enter6Digits'))
      return
    }
    setStep('confirm')
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
    const { error: err } = await updatePin(newPin)
    setIsSaving(false)
    if (err) {
      setError(err)
      setConfirmPin('')
    } else {
      setSuccess(true)
      setNewPin('')
      setConfirmPin('')
      setStep('new')
    }
  }

  const handleReset = () => {
    setStep('new')
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

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-2">
      {/* Header */}
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
        {/* Step indicator */}
        <div className="flex items-center gap-3">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full border font-mono text-xs font-bold ${
            step === 'new' ? 'border-accent bg-accent text-ink' : 'border-ok bg-ok text-ink'
          }`}>1</div>
          <span className={`text-xs ${step === 'new' ? 'text-fg-1' : 'text-fg-2'}`}>
            {t('auth.pin.stepNew')}
          </span>
          <div className="h-px flex-1 bg-line" />
          <div className={`flex h-6 w-6 items-center justify-center rounded-full border font-mono text-xs font-bold ${
            step === 'confirm' ? 'border-accent bg-accent text-ink' : 'border-line text-fg-3'
          }`}>2</div>
          <span className={`text-xs ${step === 'confirm' ? 'text-fg-1' : 'text-fg-3'}`}>
            {t('auth.pin.stepConfirm')}
          </span>
        </div>

        {error && (
          <div role="alert" className="rounded-s border border-err/30 bg-err/10 px-3 py-2 text-sm text-err">
            {error}
          </div>
        )}

        {/* PIN display */}
        <div>
          <p className="mb-3 text-xs font-medium text-fg-3">
            {step === 'new' ? t('auth.pin.enterNew') : t('auth.pin.reenterNew')}
          </p>
          <div className="flex justify-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`h-10 w-10 rounded-s border font-mono text-lg font-bold flex items-center justify-center transition-colors ${
                  i < currentPin.length
                    ? 'border-accent bg-accent/10 text-fg-1'
                    : 'border-line bg-bg-2 text-fg-4'
                }`}
              >
                {i < currentPin.length ? '•' : ''}
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

        {/* Actions */}
        <div className="flex gap-2">
          {step === 'new' ? (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 rounded-s border border-line px-4 py-2.5 text-sm font-medium text-fg-2 transition-colors hover:text-fg-1"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={newPin.length !== 6}
                className="flex-1 rounded-s bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {t('common.next')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 rounded-s border border-line px-4 py-2.5 text-sm font-medium text-fg-2 transition-colors hover:text-fg-1"
              >
                {t('common.back')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || confirmPin.length !== 6}
                className="flex-1 rounded-s bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isSaving ? t('common.saving') : t('auth.pin.savePIN')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
