/**
 * Picks who owns a company or freelancer in the portal. The three modes and the
 * resolver behind them live in `./portalAccount`.
 */

import { useTranslation } from 'react-i18next'
import { useContractorAccounts, type PortalAccountChoice, type PortalAccountMode } from './portalAccount'

interface Props {
  value: PortalAccountChoice
  onChange: (next: PortalAccountChoice) => void
  /** Shown as the login that will be created, in the 'new' branch. */
  email: string
  inputClass: string
}

const MODES: PortalAccountMode[] = ['new', 'existing', 'none']

export function PortalAccountPicker({ value, onChange, email, inputClass }: Props) {
  const { t } = useTranslation()
  const { accounts, loaded } = useContractorAccounts()

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-fg-2">{t('compliance.account.title').toUpperCase()} *</p>

      <div className="flex gap-2">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange({ ...value, mode })}
            className={`flex-1 rounded-s border px-3 py-2 text-xs transition-colors ${
              value.mode === mode
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-line text-fg-2 hover:text-fg-1'
            }`}
          >
            {t(`compliance.account.mode.${mode}`)}
          </button>
        ))}
      </div>

      {value.mode === 'new' && (
        <div>
          <p className="mb-2 text-xs text-fg-3">
            {t('compliance.wizard.accountHint', { email: email || '—' })}
          </p>
          <label className="mb-1 block font-mono text-xs text-fg-2">
            {t('compliance.wizard.tempPassword').toUpperCase()} *
          </label>
          <input
            type="text"
            value={value.password}
            onChange={(e) => onChange({ ...value, password: e.target.value })}
            className={inputClass}
          />
        </div>
      )}

      {value.mode === 'existing' && (
        <div>
          <select
            value={value.profileId ?? ''}
            onChange={(e) => onChange({ ...value, profileId: e.target.value || null })}
            className={inputClass}
          >
            <option value="">{t('compliance.account.choose')}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.full_name}
                {account.email ? ` · ${account.email}` : ''}
              </option>
            ))}
          </select>
          {loaded && accounts.length === 0 && (
            <p className="mt-2 text-xs text-fg-3">{t('compliance.account.noneAvailable')}</p>
          )}
        </div>
      )}

      {value.mode === 'none' && (
        <p className="rounded-s border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
          {t('compliance.account.noneWarning')}
        </p>
      )}
    </div>
  )
}
