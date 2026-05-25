import { supabase, isDemoSupabase } from '@/lib/supabase'
import type { AuthUser } from '@/context/authTypes'
import type { Database } from '@/types/database.types'
import { DEMO_PASSWORD, DEMO_TECH_PIN } from '@/lib/demo/fixtures'
import {
  clearPinSession,
  getOfflinePinUser,
  getPinAccessToken,
  getPinDeviceId,
  getStoredPinSession,
  storePinSession,
} from './pinSession'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

const PIN_LOGIN_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pin-login`
const UPDATE_PIN_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-pin`

export interface SignInResult {
  user: AuthUser | null
  error: string | null
}

interface PinLoginResponse {
  accessToken: string
  expiresAt: number
  user: {
    id: string
    email: string | null
    fullName: string
    role: AuthUser['role']
    team: AuthUser['team']
    loginCode: string | null
  }
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

  async signInWithLoginCode(loginCode: string, pin: string): Promise<SignInResult> {
    const trimmedCode = loginCode.trim().toLowerCase()
    const trimmedPin = pin.trim()

    if (!trimmedCode || !/^\d{4,8}$/.test(trimmedPin)) {
      return { user: null, error: 'Login-Code und PIN sind erforderlich.' }
    }

    if (isDemoSupabase) {
      if (trimmedPin !== DEMO_TECH_PIN) {
        return { user: null, error: 'Login-Code oder PIN ungültig.' }
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('pin_login_code', trimmedCode)
        .single()
      if (!profile?.email) {
        return { user: null, error: 'Login-Code oder PIN ungültig.' }
      }
      const result = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: DEMO_PASSWORD,
      })
      if (result.error) {
        return { user: null, error: 'Demo-Login fehlgeschlagen.' }
      }
      return { user: profileToAuthUser(profile), error: null }
    }

    const deviceId = getPinDeviceId()

    try {
      const response = await fetch(PIN_LOGIN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ loginCode: trimmedCode, pin: trimmedPin, deviceId }),
      })

      if (!response.ok) {
        return { user: null, error: 'Login-Code oder PIN ungültig.' }
      }

      const payload = (await response.json()) as PinLoginResponse
      const authUser: AuthUser & { loginCode?: string | null } = {
        id: payload.user.id,
        email: payload.user.email,
        fullName: payload.user.fullName,
        role: payload.user.role,
        team: payload.user.team,
        loginCode: payload.user.loginCode,
      }

      await storePinSession(payload.accessToken, payload.expiresAt, authUser, trimmedPin)
      return { user: authUser, error: null }
    } catch {
      // Network failure → try offline validation against the locally cached hash
      const offlineUser = await getOfflinePinUser(trimmedCode, trimmedPin)
      if (offlineUser) {
        return { user: offlineUser, error: null }
      }
      return { user: null, error: 'Keine Verbindung. Offline-Login fehlgeschlagen.' }
    }
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const pinToken = getPinAccessToken()
    if (pinToken) {
      const stored = getStoredPinSession()
      if (stored) return stored.user
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) return null
    return fetchProfile(session.user.id)
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

  async updatePin(currentPin: string, newPin: string): Promise<{ error: string | null }> {
    const trimmedCurrent = currentPin.trim()
    const trimmedNew = newPin.trim()

    if (!/^\d{4,8}$/.test(trimmedNew)) {
      return { error: 'PIN muss 4 bis 8 Ziffern haben.' }
    }

    const token = getPinAccessToken()
    if (!token) {
      return { error: 'Keine aktive PIN-Sitzung. Bitte erneut anmelden.' }
    }

    try {
      const response = await fetch(UPDATE_PIN_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPin: trimmedCurrent, newPin: trimmedNew }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        return { error: payload?.error ?? 'PIN konnte nicht geändert werden.' }
      }

      return { error: null }
    } catch {
      return { error: 'Keine Verbindung. PIN-Änderung fehlgeschlagen.' }
    }
  },
}
