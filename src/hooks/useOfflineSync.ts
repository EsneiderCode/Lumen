import { useEffect, useSyncExternalStore } from 'react'
import {
  getOfflineSyncState,
  refreshPendingCounts,
  runSync,
  subscribeOfflineSync,
  type OfflineSyncState,
} from '@/services/offlineSyncState'

/** How often a drain is retried while something is still queued. */
const RETRY_MS = 60_000

/**
 * Reads the offline queue state and, when `drive` is set, keeps it moving: one
 * drain on mount, one on every `online` event, and a slow retry while anything
 * is still waiting. Exactly one mounted component should drive — the layout's
 * OfflineBanner does — everyone else just reads.
 */
export function useOfflineSync(drive = false): OfflineSyncState {
  const state = useSyncExternalStore(subscribeOfflineSync, getOfflineSyncState)

  useEffect(() => {
    if (!drive) return

    let cancelled = false
    const attempt = () => {
      if (cancelled) return
      void runSync()
    }

    void refreshPendingCounts().then((pending) => {
      if (!cancelled && (pending.photos > 0 || pending.submissions > 0)) attempt()
    })

    window.addEventListener('online', attempt)
    const timer = window.setInterval(() => {
      const current = getOfflineSyncState()
      if (current.pending.photos > 0 || current.pending.submissions > 0) attempt()
    }, RETRY_MS)

    return () => {
      cancelled = true
      window.removeEventListener('online', attempt)
      window.clearInterval(timer)
    }
  }, [drive])

  return state
}
