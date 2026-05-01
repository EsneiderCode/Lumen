import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { createDemoSupabaseClient } from './demo/supabase-mock'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const isDemoMode = import.meta.env.VITE_DEMO === 'true'

function buildClient(): SupabaseClient<Database> {
  if (isDemoMode) {
    // eslint-disable-next-line no-console
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
  })
}

export const supabase: SupabaseClient<Database> = buildClient()
export const isDemoSupabase = isDemoMode
