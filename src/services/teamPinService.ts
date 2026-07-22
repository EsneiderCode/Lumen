import { supabase } from '@/lib/supabase'

const SET_TEAM_PIN_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-team-pin`

export type { TeamColor } from '@/types/enums'
import type { TeamColor } from '@/types/enums'

export interface TeamPinStatus {
  team_color: TeamColor
  has_pin: boolean
  updated_at: string | null
}

async function authHeader(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session ? `Bearer ${data.session.access_token}` : null
}

export async function fetchTeamPinStatuses(): Promise<{ data: TeamPinStatus[]; error: string | null }> {
  const auth = await authHeader()
  if (!auth) return { data: [], error: 'Nicht angemeldet.' }
  try {
    const res = await fetch(SET_TEAM_PIN_ENDPOINT, {
      method: 'GET',
      headers: { authorization: auth, 'content-type': 'application/json' },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      return { data: [], error: body?.error ?? 'Fehler beim Laden.' }
    }
    const body = await res.json() as { teams: TeamPinStatus[] }
    return { data: body.teams, error: null }
  } catch {
    return { data: [], error: 'Verbindungsfehler.' }
  }
}

export async function setTeamPin(
  teamColor: TeamColor,
  pin: string,
): Promise<{ error: string | null }> {
  const auth = await authHeader()
  if (!auth) return { error: 'Nicht angemeldet.' }
  try {
    const res = await fetch(SET_TEAM_PIN_ENDPOINT, {
      method: 'POST',
      headers: { authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ teamColor, pin }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      return { error: body?.error ?? 'Fehler beim Speichern.' }
    }
    return { error: null }
  } catch {
    return { error: 'Verbindungsfehler.' }
  }
}
