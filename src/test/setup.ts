import '@testing-library/jest-dom'

// jsdom under newer Node does not expose window.localStorage unless the runner
// is started with --localstorage-file. The demo store persists to localStorage,
// so without it the demo persistence layer is never actually exercised (tests
// that read state back pass vacuously) and tests that poke localStorage directly
// crash. Provide a minimal in-memory polyfill so persistence behaves for real.
if (typeof window !== 'undefined' && typeof window.localStorage === 'undefined') {
  const backing = new Map<string, string>()
  const polyfill: Storage = {
    get length() {
      return backing.size
    },
    clear: () => backing.clear(),
    getItem: (key) => (backing.has(key) ? (backing.get(key) as string) : null),
    key: (index) => Array.from(backing.keys())[index] ?? null,
    removeItem: (key) => {
      backing.delete(key)
    },
    setItem: (key, value) => {
      backing.set(key, String(value))
    },
  }
  Object.defineProperty(window, 'localStorage', { value: polyfill, configurable: true })
}
