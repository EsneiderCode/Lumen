// The one IndexedDB the app owns.
//
// Everything the technician does without coverage lands here: the photos still
// to upload, the Rückmeldung waiting to be sent, and a snapshot of the order it
// belongs to so the form can be opened again with no network at all.
//
// Deliberately hand-rolled instead of pulling in `idb`: four stores, five
// operations, and a wrapper small enough to read in one sitting. Every helper
// resolves or rejects — a rejected promise is a real storage failure and the
// callers treat it as "this device cannot queue", never as "queued".

const DB_NAME = 'lumen-offline'
/** v1 was the never-wired Rückmeldung queue; v2 adds the stores below. */
const DB_VERSION = 2

export const STORE_PHOTOS = 'photo-queue'
export const STORE_SUBMISSIONS = 'submission-queue'
export const STORE_ORDERS = 'order-cache'
/** v1 store, kept so an upgrade never drops data that might exist on a device. */
export const STORE_LEGACY = 'rueckmeldung-queue'

let dbPromise: Promise<IDBDatabase> | null = null

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

export function openLumenDb(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available'))
  }
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_LEGACY)) {
        db.createObjectStore(STORE_LEGACY, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        const photos = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id', autoIncrement: true })
        photos.createIndex('workOrderId', 'workOrderId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_SUBMISSIONS)) {
        // One pending submission per order: sending twice replaces the first.
        db.createObjectStore(STORE_SUBMISSIONS, { keyPath: 'workOrderId' })
      }
      if (!db.objectStoreNames.contains(STORE_ORDERS)) {
        db.createObjectStore(STORE_ORDERS, { keyPath: 'workOrderId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      dbPromise = null
      reject(request.error ?? new Error('IndexedDB could not be opened'))
    }
  })

  return dbPromise
}

/** Drops the cached handle. Tests reopen against a fresh fake; the app never calls it. */
export function resetLumenDb() {
  dbPromise = null
}

export async function idbPut<T>(store: string, value: T): Promise<IDBValidKey> {
  const db = await openLumenDb()
  const tx = db.transaction(store, 'readwrite')
  const key = await requestToPromise(tx.objectStore(store).put(value as never))
  return key
}

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | null> {
  const db = await openLumenDb()
  const tx = db.transaction(store, 'readonly')
  const value = await requestToPromise(tx.objectStore(store).get(key))
  return (value as T | undefined) ?? null
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openLumenDb()
  const tx = db.transaction(store, 'readonly')
  return (await requestToPromise(tx.objectStore(store).getAll())) as T[]
}

export async function idbGetAllByIndex<T>(
  store: string,
  index: string,
  value: IDBValidKey,
): Promise<T[]> {
  const db = await openLumenDb()
  const tx = db.transaction(store, 'readonly')
  return (await requestToPromise(tx.objectStore(store).index(index).getAll(value))) as T[]
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openLumenDb()
  const tx = db.transaction(store, 'readwrite')
  await requestToPromise(tx.objectStore(store).delete(key))
}

export async function idbCount(store: string): Promise<number> {
  const db = await openLumenDb()
  const tx = db.transaction(store, 'readonly')
  return await requestToPromise(tx.objectStore(store).count())
}
