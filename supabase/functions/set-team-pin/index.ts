import { CORS_HEADERS, env, json, selectOne, supabaseFetch, userIdFromJwt } from '../_shared/http.ts'
import { assertValidPin, hashPin } from '../_shared/pin.ts'

type UserRole = 'admin' | 'technician' | 'contractor'
type TeamColor =
  | 'rot' | 'gruen' | 'blau' | 'gelb'
  | 'weiss' | 'grau' | 'braun' | 'violett'
  | 'tuerkis' | 'schwarz' | 'orange' | 'rosa'

const VALID_TEAMS: TeamColor[] = [
  'rot', 'gruen', 'blau', 'gelb',
  'weiss', 'grau', 'braun', 'violett',
  'tuerkis', 'schwarz', 'orange', 'rosa',
]

interface TeamPinRow {
  id: string
  team_color: string
  updated_at: string
}

async function requireAdmin(
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<Response | null> {
  const auth = req.headers.get('authorization')
  if (!auth) return json(401, { error: 'Missing authorization' })

  const userId = userIdFromJwt(auth)
  if (!userId) return json(401, { error: 'Invalid authorization' })

  const profile = await selectOne<{ role: UserRole; is_active: boolean }>(
    supabaseUrl,
    serviceRoleKey,
    'profiles',
    `select=role,is_active&id=eq.${encodeURIComponent(userId)}`,
  )
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return json(403, { error: 'Admin access required' })
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const supabaseUrl = env('SUPABASE_URL')
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')

    const authError = await requireAdmin(req, supabaseUrl, serviceRoleKey)
    if (authError) return authError

    // ── GET: list which teams have a PIN set ───────────────────────────────
    if (req.method === 'GET') {
      const rows = await supabaseFetch<TeamPinRow[]>(
        supabaseUrl,
        serviceRoleKey,
        'team_pins?select=id,team_color,updated_at',
        { method: 'GET' },
      )
      const existing = Array.isArray(rows) ? rows : []
      const result = VALID_TEAMS.map((color) => {
        const row = existing.find((r) => r.team_color === color)
        return { team_color: color, has_pin: !!row, updated_at: row?.updated_at ?? null }
      })
      return json(200, { teams: result })
    }

    // ── POST: set / update a team PIN ──────────────────────────────────────
    if (req.method === 'POST') {
      const body = await req.json().catch(() => null) as Record<string, unknown> | null
      const teamColor = typeof body?.teamColor === 'string' ? body.teamColor.trim() : ''
      const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''

      if (!VALID_TEAMS.includes(teamColor as TeamColor)) {
        return json(400, { error: `teamColor must be one of: ${VALID_TEAMS.join(', ')}` })
      }

      assertValidPin(pin)   // throws if not 4–8 digits; for team PINs we enforce 6 at the UI layer
      const pinHash = await hashPin(pin)

      await supabaseFetch<void>(
        supabaseUrl,
        serviceRoleKey,
        'team_pins?on_conflict=team_color',
        {
          method: 'POST',
          headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            team_color: teamColor,
            pin_hash: pinHash,
            updated_at: new Date().toISOString(),
          }),
        },
      )

      return json(200, { ok: true, team_color: teamColor })
    }

    return json(405, { error: 'Method not allowed' })
  } catch (error) {
    console.error('[set-team-pin] failed', error)
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
})
