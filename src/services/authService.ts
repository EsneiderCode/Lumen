import { supabase } from '@/lib/supabase'
import type { AuthUser } from '@/context/authTypes'
import type { Database } from '@/types/database.types'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

export interface SignInResult {
  user: AuthUser | null
  error: string | null
}

function profileToAuthUser(p: ProfileRow): AuthUser {
  return {
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    role: p.role,
    team: p.team,
  }
}

async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return profileToAuthUser(data)
}

export const authService = {
  async signInWithEmail(email: string, password: string): Promise<SignInResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return { user: null, error: error.message }
    }

    const profile = await fetchProfile(data.user.id)
    if (!profile) {
      return { user: null, error: 'Profil nicht gefunden. Kontaktieren Sie den Administrator.' }
    }

    return { user: profile, error: null }
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) return null
    return fetchProfile(session.user.id)
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut()
  },

  async resetPassword(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error?.message ?? null }
  },

  async updatePassword(newPassword: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error?.message ?? null }
  },
}
