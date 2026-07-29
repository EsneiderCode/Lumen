import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isStaleChunkError, reloadForNewBuild } from '@/lib/staleChunk'

describe('isStaleChunkError', () => {
  it('matches the MIME error behind the SPA rewrite', () => {
    // What the browser reports when a missing chunk is answered with
    // index.html: HTML arrives where a module was expected.
    expect(
      isStaleChunkError(new TypeError("'text/html' is not a valid JavaScript MIME type.")),
    ).toBe(true)
  })

  it('matches the failed dynamic import wording of each browser', () => {
    const messages = [
      'Failed to fetch dynamically imported module: https://lumen.hmr-nexus.com/assets/WorkOrdersPage-a3f9c1.js',
      'error loading dynamically imported module',
      'Importing a module script failed.',
    ]
    for (const message of messages) {
      expect(isStaleChunkError(new Error(message))).toBe(true)
    }
  })

  it('does not swallow ordinary application errors', () => {
    // A real crash must still reach the error screen — reloading would hide it.
    expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isStaleChunkError(new Error('Kundenabnahme fehlgeschlagen'))).toBe(false)
    expect(isStaleChunkError(null)).toBe(false)
    expect(isStaleChunkError(undefined)).toBe(false)
  })
})

describe('reloadForNewBuild', () => {
  const reload = vi.fn()

  beforeEach(() => {
    reload.mockClear()
    window.sessionStorage.clear()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    })
  })

  it('reloads the first time a stale chunk shows up', () => {
    expect(reloadForNewBuild(1_000_000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('refuses to reload again right away, so a broken deploy cannot loop', () => {
    expect(reloadForNewBuild(1_000_000)).toBe(true)
    expect(reloadForNewBuild(1_010_000)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('allows a fresh reload once the guard window has passed', () => {
    expect(reloadForNewBuild(1_000_000)).toBe(true)
    // A later deploy in the same session deserves its own reload.
    expect(reloadForNewBuild(1_000_000 + 30_001)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})
