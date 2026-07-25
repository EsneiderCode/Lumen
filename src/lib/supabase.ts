import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import i18n from '@/i18n'
import type { Database } from '@/types/database.types'
import { createDemoSupabaseClient } from './demo/supabase-mock'
import { clearPinSession, getPinSessionStatus, notifyPinSessionExpired } from '@/services/pinSession'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const isDemoMode = import.meta.env.VITE_DEMO === 'true'

// Safety guard: demo mode must never run in a production build.
// If this throws at startup, set VITE_DEMO=false (or remove it) in your production env.
if (import.meta.env.PROD && isDemoMode) {
  throw new Error(
    '[Lumen] Demo mode (VITE_DEMO=true) must not run in a production build. ' +
    'Remove or set VITE_DEMO=false in your production environment variables.',
  )
}

function buildClient(): SupabaseClient<Database> {
  if (isDemoMode) {
    console.info(
      '%c[Lumen] Demo mode active — Supabase calls hit an in-memory store backed by localStorage. Reset with `localStorage.removeItem("lumen-demo-store-v1")`.',
      'color: #FF4D2E; font-weight: 500',
    )
    return createDemoSupabaseClient() as unknown as SupabaseClient<Database>
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Copy .env.example to .env.development and fill in your credentials, or run with VITE_DEMO=true to use the offline demo store.',
    )
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        const isAuthEndpoint = url.includes('/auth/v1/')
        const pin = getPinSessionStatus()

        // An expired PIN session must never fall through to the anon key: the
        // request would run as `anon`, so reads come back empty and writes die
        // with a cryptic RLS 42501 instead of asking the user to log in again.
        if (pin.status === 'expired' && !isAuthEndpoint) {
          clearPinSession()
          notifyPinSessionExpired()
          throw new Error(i18n.t('errors.sessionExpired'))
        }

        if (pin.status !== 'active' || isAuthEndpoint) {
          return fetch(input, init)
        }

        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
        headers.set('Authorization', `Bearer ${pin.accessToken}`)
        return fetch(input, { ...init, headers })
      },
    },
  })
}

export const supabase: SupabaseClient<Database> = buildClient()
export const isDemoSupabase = isDemoMode
