// Keeping the basemap available with no signal.
//
// The app is a PWA for technicians who work in trenches, and its data already
// survives offline through the Supabase runtime cache. The map did not: tiles
// were the one thing nothing cached, so losing signal turned it into a flat
// rectangle with the pins floating on it.
//
// PMTiles asks for byte RANGES of one archive, never the whole thing, and a
// cache keyed by URL cannot hold ranges — the second range would be served the
// first one's bytes. Workbox's range plugin solves it, but only if the cache
// already holds ONE FULL copy of the archive. Putting that copy there is this
// file's only job; the runtime caching rule in vite.config.ts does the rest.
//
// The cache NAME is shared with vite.config.ts, which is type-checked without
// the DOM lib — hence src/constants/basemap.ts and not a const here.

export { BASEMAP_CACHE } from '@/constants/basemap'
import { BASEMAP_CACHE } from '@/constants/basemap'

/**
 * Store the whole archive once, so later range requests can be sliced out of it
 * offline. Deliberately quiet and best-effort: this is an optimisation for the
 * field, never a precondition for the map working, so a failure here must not
 * reach the user — they already have a network problem if it fails.
 *
 * `cache.add` issues a plain GET with no Range header, which is what makes the
 * stored response a complete 200 rather than a partial 206.
 */
export async function warmBasemapCache(archiveUrl: string): Promise<void> {
  if (typeof caches === 'undefined' || !archiveUrl.startsWith('http')) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  try {
    const cache = await caches.open(BASEMAP_CACHE)
    // Already warm: re-downloading megabytes on every map open would cost the
    // technician exactly the data this is meant to save.
    if (await cache.match(archiveUrl)) return
    await cache.add(archiveUrl)
  } catch {
    // Offline, quota exhausted, or the browser has no Cache API. All three mean
    // "no offline map", which is the state we were already in.
  }
}
