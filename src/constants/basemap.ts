// Shared by the app and by vite.config.ts, which is why it lives here alone and
// touches nothing: the build config is type-checked without the DOM lib, so
// anything importing `caches` or `navigator` cannot be in this file.
// The behaviour that uses this name is in src/lib/basemapCache.ts.

export const BASEMAP_CACHE = 'basemap-archive'
