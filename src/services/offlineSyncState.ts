/**
 * The one place that knows whether anything is waiting to be uploaded.
 *
 * A module-level store rather than a context: the banner (in every layout) and
 * the Rückmeldung screen both need it, they are never in the same subtree, and
 * `useSyncExternalStore` gives them the same value without another provider
 * around the app.
 *
 * `runSync()` is serialised on purpose — the `online` event, the screen that
 * just queued a photo and the interval tick all call it, and two drains at once
 * would upload the same photo twice.
 */

import { countPending, type PendingCounts } from '@/services/offlineQueue'
import { syncOfflineQueue, type SyncResult } from '@/services/offlineSync'

export interface OfflineSyncState {
  pending: PendingCounts
  isSyncing: boolean
  /** ISO timestamp of the last drain that changed something. */
  lastSyncAt: string | null
  lastError: string | null
}

let state: OfflineSyncState = {
  pending: { photos: 0, submissions: 0 },
  isSyncing: false,
  lastSyncAt: null,
  lastError: null,
}

const listeners = new Set<() => void>()
let inFlight: Promise<SyncResult> | null = null

function setState(patch: Partial<OfflineSyncState>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

export function subscribeOfflineSync(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getOfflineSyncState(): OfflineSyncState {
  return state
}

/** Test seam: drops listeners and counters between cases. */
export function resetOfflineSyncState() {
  state = {
    pending: { photos: 0, submissions: 0 },
    isSyncing: false,
    lastSyncAt: null,
    lastError: null,
  }
  inFlight = null
  listeners.clear()
}

export async function refreshPendingCounts(): Promise<PendingCounts> {
  const pending = await countPending()
  setState({ pending })
  return pending
}

/** Drains the queue. Concurrent callers share the run that is already going. */
export async function runSync(): Promise<SyncResult> {
  if (inFlight) return inFlight

  setState({ isSyncing: true })
  inFlight = syncOfflineQueue()

  try {
    const result = await inFlight
    const changed = result.photosUploaded > 0 || result.submissionsSent > 0
    setState({
      isSyncing: false,
      lastError: result.error,
      ...(changed ? { lastSyncAt: new Date().toISOString() } : {}),
    })
    await refreshPendingCounts()
    return result
  } finally {
    inFlight = null
    // A throw would otherwise leave the banner spinning forever.
    if (state.isSyncing) setState({ isSyncing: false })
  }
}
