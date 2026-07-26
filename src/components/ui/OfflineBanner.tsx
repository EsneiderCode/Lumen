import { useTranslation } from 'react-i18next'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { runSync } from '@/services/offlineSyncState'

/** wifi-off — 1.5px monoline, per the NEXUS icon rule. */
function WifiOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  )
}

/** upload-cloud — same stroke family as the offline icon. */
function UploadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d="M16 16l-4-4-4 4" />
      <path d="M12 12v9" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}

/**
 * The one component that drives the offline queue: it is mounted in every
 * layout, exactly once, so `useOfflineSync(true)` here means the queue drains
 * wherever the technician happens to be — not only on the Rückmeldung screen.
 *
 * Three states, in order of urgency: no connection, something still waiting to
 * upload, and nothing to say (renders nothing).
 */
export function OfflineBanner() {
  const { t } = useTranslation()
  const isOnline = useOnlineStatus()
  const { pending, isSyncing, lastError } = useOfflineSync(true)

  const waiting = pending.photos + pending.submissions

  if (!isOnline) {
    return (
      <div role="alert" className="flex items-center gap-2 border-b border-warn bg-bg-0 px-4 py-2">
        <span className="text-warn">
          <WifiOffIcon />
        </span>
        <span className="nx-label text-warn">
          {waiting > 0 ? t('offline.bannerQueued', { count: waiting }) : t('offline.banner')}
        </span>
      </div>
    )
  }

  if (waiting === 0) return null

  // Something is refusing to go up — a rejected upload, or a status the server
  // will not accept. Retrying it silently every minute would leave the
  // technician believing their Rückmeldung is on its way.
  const blocked = !isSyncing && lastError !== null

  return (
    <div
      role="status"
      className={`flex items-center gap-2 border-b bg-bg-0 px-4 py-2 ${
        blocked ? 'border-warn' : 'border-line'
      }`}
    >
      <span className={blocked ? 'text-warn' : 'text-info'}>
        <UploadIcon />
      </span>
      <span className={`nx-label ${blocked ? 'text-warn' : 'text-fg-2'}`}>
        {isSyncing
          ? t('offline.syncing', { count: waiting })
          : blocked
            ? t('offline.pendingBlocked', { count: waiting, error: lastError })
            : t('offline.pending', { count: waiting })}
      </span>
      {!isSyncing ? (
        <button
          type="button"
          onClick={() => void runSync()}
          className="nx-label text-accent underline"
        >
          {t('offline.syncNow')}
        </button>
      ) : null}
    </div>
  )
}
