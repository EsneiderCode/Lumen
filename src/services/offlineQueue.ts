/**
 * Offline queue for Rückmeldung submissions.
 *
 * When a technician submits a Rückmeldung without network access, the payload
 * is stored in IndexedDB. On reconnection, the caller is responsible for
 * draining the queue with `flushQueue`.
 *
 * DB:    lumen-offline
 * Store: rueckmeldung-queue
 */

const DB_NAME = 'lumen-offline'
const STORE = 'rueckmeldung-queue'
const DB_VERSION = 1

export interface QueuedRueckmeldung {
  id?: number
  workOrderId: string
  payload: Record<string, unknown>
  queuedAt: string // ISO timestamp
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Add a Rückmeldung payload to the offline queue. */
export async function enqueueRueckmeldung(
  workOrderId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const entry: QueuedRueckmeldung = {
      workOrderId,
      payload,
      queuedAt: new Date().toISOString(),
    }
    const req = tx.objectStore(STORE).add(entry)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Return all pending entries (oldest first). */
export async function getPendingQueue(): Promise<QueuedRueckmeldung[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as QueuedRueckmeldung[])
    req.onerror = () => reject(req.error)
  })
}

/** Remove a successfully synced entry by its auto-incremented id. */
export async function removeFromQueue(id: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Drain the queue using the provided submit function.
 * Each entry is removed only after the submit resolves successfully.
 * Failed entries remain in the queue for the next flush.
 */
export async function flushQueue(
  submitFn: (entry: QueuedRueckmeldung) => Promise<void>,
): Promise<{ flushed: number; failed: number }> {
  const entries = await getPendingQueue()
  let flushed = 0
  let failed = 0

  for (const entry of entries) {
    try {
      await submitFn(entry)
      await removeFromQueue(entry.id!)
      flushed++
    } catch {
      failed++
    }
  }

  return { flushed, failed }
}
