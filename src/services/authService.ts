import { supabase } from '@/lib/supabase'
import type { AuthUser } from '@/context/authTypes'
import type { Database } from '@/types/database.types'
import type { TeamColor } from '@/types/enums'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

const TEAM_EMAIL_DOMAIN = 'nexus.internal'

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
    if (error) {
      // SMTP not configured → Supabase returns 500 with "Error sending" message
      const msg = error.message.toLowerCase()
      if (msg.includes('sending') || msg.includes('smtp') || msg.includes('email') || error.status === 500) {
        return {
          error:
            'Der E-Mail-Dienst ist noch nicht konfiguriert. Wenden Sie sich an den Administrator für das Zurücksetzen Ihres Passworts.',
        }
      }
      return { error: error.message }
    }
    return { error: null }
  },

  async updatePassword(newPassword: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error?.message ?? null }
  },

  async signInWithPin(team: TeamColor, pin: string): Promise<SignInResult> {
    const email = `${team}@${TEAM_EMAIL_DOMAIN}`
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pin })

    if (error) {
      return { user: null, error: 'PIN oder Team ungültig. Bitte erneut versuchen.' }
    }

    const profile = await fetchProfile(data.user.id)
    if (!profile) {
      return { user: null, error: 'Profil nicht gefunden. Kontaktieren Sie den Administrator.' }
    }

    return { user: profile, error: null }
  },

  async updatePin(newPin: string): Promise<{ error: string | null }> {
    if (!/^\d{6}$/.test(newPin)) {
      return { error: 'PIN muss genau 6 Ziffern haben.' }
    }
    const { error } = await supabase.auth.updateUser({ password: newPin })
    return { error: error?.message ?? null }
  },
}
