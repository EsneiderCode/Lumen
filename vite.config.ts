import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { BASEMAP_CACHE } from './src/constants/basemap'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'LUMEN - Nexus Operations',
        short_name: 'LUMEN',
        description: 'Central operational platform for HMR Nexus Engineering',
        theme_color: '#111111',
        background_color: '#111111',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // SPA fallback: serve cached index.html for failed navigations
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          // The basemap archive. Must come before the generic Supabase rule,
          // which would otherwise swallow it: first match wins.
          //
          // `rangeRequests` is what makes this correct — PMTiles never asks for
          // the whole file, it asks for byte ranges of it, and this plugin
          // slices them out of the one full copy in the cache. Hence
          // `statuses: [200]`: a 206 must NEVER be stored, because it would be
          // keyed by URL alone and the next range would be served the previous
          // range's bytes. The full copy is put there deliberately, once, by
          // warmBasemapCache() in NexusMap.
          {
            urlPattern: /\/storage\/v1\/object\/public\/basemap\/.*\.pmtiles$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: BASEMAP_CACHE,
              rangeRequests: true,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 180 },
            },
          },
          // Glyphs are ordinary immutable GETs; without them the map draws but
          // every street and town is unlabelled.
          {
            urlPattern: /\/storage\/v1\/object\/public\/basemap\/fonts\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'basemap-glyphs',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 180 },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/services/**', 'src/types/**'],
    },
  },
})
