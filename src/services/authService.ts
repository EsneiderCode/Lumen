import { supabase } from '@/lib/supabase'
import type { AuthUser } from '@/context/authTypes'
import type { Database } from '@/types/database.types'
import {
  clearPinSession,
  getOfflinePinUser,
  getPinDeviceId,
  getStoredPinSession,
  storePinSession,
} from '@/services/pinSession'

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
    loginCode: p.pin_login_code,
  }
}

async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,team,is_active,pin_login_code,created_at,updated_at,pin_set_at,last_pin_login_at')
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
    const pinSession = getStoredPinSession()
    if (pinSession?.accessToken && pinSession.expiresAt * 1000 > Date.now()) {
      const profile = await fetchProfile(pinSession.user.id).catch(() => null)
      if (profile) return { ...profile, authMethod: 'pin' }
      return { ...pinSession.user, authMethod: 'offline-pin' }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) return null
    return fetchProfile(session.user.id)
  },

  async signInWithPin(loginCode: string, pin: string): Promise<SignInResult> {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
    if (isOffline) {
      const offlineUser = await getOfflinePinUser(loginCode, pin)
      return offlineUser
        ? { user: { ...offlineUser, authMethod: 'offline-pin' }, error: null }
        : { user: null, error: 'Offline login not available on this device. Sign in online once first.' }
    }

    const { data, error } = await supabase.functions.invoke<{
      accessToken: string
      expiresAt: number
      user: AuthUser & { loginCode?: string | null }
    }>('pin-login', {
      body: {
        loginCode: loginCode.trim(),
        pin,
        deviceId: getPinDeviceId(),
      },
    })

    if (error || !data?.user || !data.accessToken) {
      return { user: null, error: error?.message ?? 'PIN login failed' }
    }

    const user = { ...data.user, authMethod: 'pin' as const }
    await storePinSession(data.accessToken, data.expiresAt, user, pin)
    return { user, error: null }
  },

  async signOut(): Promise<void> {
    clearPinSession()
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
}
