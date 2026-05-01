/**
 * In-memory demo store backed by localStorage.
 * Persists across reloads so the user can create/edit during a session
 * without losing state. `resetStore()` brings it back to fixtures.
 */

import { initialFixtures, type DemoStore } from './fixtures'

const STORE_KEY = 'lumen-demo-store-v1'

export function getStore(): DemoStore {
  if (typeof window === 'undefined') return initialFixtures()
  const raw = window.localStorage.getItem(STORE_KEY)
  if (raw) {
    try {
      return JSON.parse(raw) as DemoStore
    } catch {
      // fall through to reseed
    }
  }
  const fresh = initialFixtures()
  saveStore(fresh)
  return fresh
}

export function saveStore(s: DemoStore): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORE_KEY, JSON.stringify(s))
}

export function resetStore(): DemoStore {
  if (typeof window === 'undefined') return initialFixtures()
  window.localStorage.removeItem(STORE_KEY)
  return getStore()
}

/** Mutate one table inside the store and persist. */
export function withTable<K extends keyof DemoStore>(
  key: K,
  fn: (rows: DemoStore[K]) => DemoStore[K],
): DemoStore[K] {
  const store = getStore()
  const next = fn(store[key])
  store[key] = next
  saveStore(store)
  return next
}

/** Read one table without mutation. */
export function readTable<K extends keyof DemoStore>(key: K): DemoStore[K] {
  return getStore()[key]
}

/** Generate a v4-ish UUID without bringing in a dependency. */
export function demoUuid(): string {
  const hex = '0123456789abcdef'
  const part = (n: number) =>
    Array.from({ length: n }, () => hex[Math.floor(Math.random() * 16)]).join('')
  return `${part(8)}-${part(4)}-4${part(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${part(3)}-${part(12)}`
}
