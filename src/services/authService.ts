import { supabase, isDemoSupabase } from '@/lib/supabase'
import type { AuthUser, TeamMember } from '@/context/authTypes'
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

const TEAM_PIN_LOGIN_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team-pin-login`
const UPDATE_PIN_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-pin`

export interface SignInResult {
  user: AuthUser | null
  error: string | null
}

interface TeamPinLookupResponse {
  team: string
  members: TeamMember[]
}

interface TeamPinLoginResponse {
  accessToken: string
  expiresAt: number
  user: {
    id: string
    email: string | null
    fullName: string
    role: AuthUser['role']
    team: AuthUser['team']
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
    // A leftover PIN session from a previous login on this device would hijack
    // every request through the fetch wrapper in lib/supabase.ts — the UI would
    // show this user while the database sees the other profile's identity.
    clearPinSession()

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

  async getTeamByPin(pin: string): Promise<{ team: string | null; members: TeamMember[]; error: string | null }> {
    const trimmedPin = pin.trim()
    if (!/^\d{6}$/.test(trimmedPin)) {
      return { team: null, members: [], error: 'Eine 6-stellige PIN ist erforderlich.' }
    }

    if (isDemoSupabase) {
      if (trimmedPin !== DEMO_TECH_PIN) {
        return { team: null, members: [], error: 'Ungültige PIN.' }
      }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role, team')
        .in('role', ['technician', 'contractor'])
        .eq('is_active', true)
      const all = profiles ?? []
      const team = all[0]?.team ?? 'rot'
      const members: TeamMember[] = all
        .filter((p) => p.team === team)
        .map((p) => ({ id: p.id, fullName: p.full_name, role: p.role as TeamMember['role'] }))
      return { team, members, error: null }
    }

    const deviceId = getPinDeviceId()
    try {
      const response = await fetch(TEAM_PIN_LOGIN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin: trimmedPin, deviceId }),
      })
      if (!response.ok) {
        return { team: null, members: [], error: 'Ungültige PIN.' }
      }
      const payload = (await response.json()) as TeamPinLookupResponse
      return { team: payload.team, members: payload.members, error: null }
    } catch {
      return { team: null, members: [], error: 'Keine Verbindung. Bitte erneut versuchen.' }
    }
  },

  async signInWithTeamPin(pin: string, profileId: string): Promise<SignInResult> {
    const trimmedPin = pin.trim()
    if (!/^\d{6}$/.test(trimmedPin) || !profileId) {
      return { user: null, error: 'PIN und Mitarbeiterauswahl sind erforderlich.' }
    }

    if (isDemoSupabase) {
      if (trimmedPin !== DEMO_TECH_PIN) {
        return { user: null, error: 'Ungültige PIN.' }
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single()
      if (!profile?.email) {
        return { user: null, error: 'Mitarbeiter nicht gefunden.' }
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
      const response = await fetch(TEAM_PIN_LOGIN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin: trimmedPin, profileId, deviceId }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const serverMsg = payload?.error
        console.error('[signInWithTeamPin] server error', response.status, serverMsg)
        return { user: null, error: serverMsg ?? 'Ungültige PIN oder Mitarbeiterauswahl.' }
      }
      const payload = (await response.json()) as TeamPinLoginResponse
      const authUser: AuthUser = {
        id: payload.user.id,
        email: payload.user.email,
        fullName: payload.user.fullName,
        role: payload.user.role,
        team: payload.user.team,
      }
      await storePinSession(payload.accessToken, payload.expiresAt, authUser, trimmedPin)
      return { user: authUser, error: null }
    } catch {
      const offlineUser = await getOfflinePinUser(trimmedPin, profileId)
      if (offlineUser) {
        return { user: offlineUser, error: null }
      }
      return { user: null, error: 'Keine Verbindung. Offline-Login fehlgeschlagen.' }
    }
  },

  async getCurrentUser(userId?: string): Promise<AuthUser | null> {
    const pinToken = getPinAccessToken()
    if (pinToken) {
      const stored = getStoredPinSession()
      if (stored) return stored.user
    }

    if (userId) return fetchProfile(userId)

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
