/**
 * Recovery from chunks left behind by a deploy.
 *
 * Every page is `lazy()`-loaded, so changing section downloads a hashed chunk
 * (`WorkOrdersPage-a3f9c1.js`). A deploy renames those files, so a tab that was
 * already open asks for a chunk that no longer exists — and, because the SPA
 * rewrite answers unknown paths with index.html, the browser gets HTML where it
 * expected JavaScript and refuses it ("'text/html' is not a valid JavaScript
 * MIME type"). Reloading fixes it, because the fresh index.html points at the
 * new hashes.
 *
 * So the app reloads itself instead of showing an error screen for something it
 * can resolve on its own.
 */

/** sessionStorage key holding when we last reloaded for this reason. */
const RELOAD_MARK = 'lumen-stale-chunk-reload'

/**
 * A second reload inside this window means reloading did not help — the chunk
 * is missing for some other reason (broken deploy, captive portal, no network).
 * Better to show the error than to spin forever.
 */
const RELOAD_WINDOW_MS = 30_000

/**
 * Whether this error is a chunk that the current build can no longer fetch.
 *
 * The wording differs per browser, so all the known shapes are matched:
 * Chrome/Edge and Firefox each phrase the failed import differently, and the
 * MIME variant is the one that shows up behind the SPA rewrite.
 */
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /is not a valid JavaScript MIME type/i.test(message)
  )
}

/** sessionStorage throws in some privacy modes; a failed read must not break recovery. */
function readMark(): number {
  try {
    return Number(window.sessionStorage.getItem(RELOAD_MARK) ?? 0)
  } catch {
    return 0
  }
}

function writeMark(at: number): void {
  try {
    window.sessionStorage.setItem(RELOAD_MARK, String(at))
  } catch {
    // Without storage we cannot guard against a loop, so recovery is skipped.
  }
}

/**
 * Reload once to pick up the new build. Returns whether a reload was started,
 * so the caller can decide what to do when it was not (show the error screen).
 */
export function reloadForNewBuild(now: number = Date.now()): boolean {
  const lastReload = readMark()
  if (lastReload !== 0 && now - lastReload < RELOAD_WINDOW_MS) return false
  writeMark(now)
  window.location.reload()
  return true
}

/**
 * Vite raises `vite:preloadError` when a dynamic import fails, which is exactly
 * the stale-chunk case. Preventing the default stops Vite from rethrowing, so
 * the reload happens without the error screen flashing first.
 */
export function installStaleChunkRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (!isStaleChunkError(event.payload)) return
    if (reloadForNewBuild()) event.preventDefault()
  })
}
