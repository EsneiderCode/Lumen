import { CORS_HEADERS, env, json, supabaseFetch } from '../_shared/http.ts'
import { sanitizeUserAgent, sha256Base64Url, verifyPin } from '../_shared/pin.ts'
import { signHs256Jwt } from '../_shared/jwt.ts'

interface TeamPinRow {
  id: string
  team_color: string
  pin_hash: string
}

interface ProfileRow {
  id: string
  email: string | null
  full_name: string
  role: 'technician' | 'contractor'
  team: string | null
  is_active: boolean
}

interface RequestBody {
  pin?: string
  deviceId?: string
  profileId?: string
}

function readBody(value: unknown): RequestBody {
  if (!value || typeof value !== 'object') return {}
  const body = value as Record<string, unknown>
  return {
    pin: typeof body.pin === 'string' ? body.pin : undefined,
    deviceId: typeof body.deviceId === 'string' ? body.deviceId : undefined,
    profileId: typeof body.profileId === 'string' ? body.profileId : undefined,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const supabaseUrl = env('SUPABASE_URL')
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')

    const body = readBody(await req.json().catch(() => null))
    const pin = body.pin?.trim()
    const deviceId = body.deviceId?.trim()
    const profileId = body.profileId?.trim()

    if (!pin || !/^\d{6}$/.test(pin)) {
      return json(400, { error: 'A 6-digit PIN is required' })
    }
    if (!deviceId) {
      return json(400, { error: 'Device ID is required' })
    }

    // ── Look up all team PINs and find one that matches ────────────────────
    const teamPinsData = await supabaseFetch<TeamPinRow[]>(
      supabaseUrl,
      serviceRoleKey,
      'team_pins?select=id,team_color,pin_hash',
      { method: 'GET' },
    )
    const teamPins: TeamPinRow[] = Array.isArray(teamPinsData) ? teamPinsData : []

    let matchedTeam: TeamPinRow | null = null
    for (const tp of teamPins) {
      const ok = await verifyPin(pin, tp.pin_hash)
      if (ok) { matchedTeam = tp; break }
    }

    if (!matchedTeam) {
      return json(401, { error: 'Invalid PIN' })
    }

    // ── Phase 1: no profileId → return team members list ──────────────────
    if (!profileId) {
      const members = await supabaseFetch<ProfileRow[]>(
        supabaseUrl,
        serviceRoleKey,
        `profiles?select=id,full_name,role,team,is_active&team=eq.${encodeURIComponent(matchedTeam.team_color)}&is_active=eq.true&role=in.(technician,contractor)`,
        { method: 'GET' },
      )
      const list = (Array.isArray(members) ? members : []).map((p) => ({
        id: p.id,
        fullName: p.full_name,
        role: p.role,
      }))

      return json(200, { team: matchedTeam.team_color, members: list })
    }

    // ── Phase 2: profileId provided → issue JWT ────────────────────────────
    const jwtSecret = env('EDGE_JWT_SECRET')

    const profilesData = await supabaseFetch<ProfileRow[]>(
      supabaseUrl,
      serviceRoleKey,
      `profiles?select=id,email,full_name,role,team,is_active&id=eq.${encodeURIComponent(profileId)}&is_active=eq.true&role=in.(technician,contractor)`,
      { method: 'GET' },
    )
    const profile: ProfileRow | null = Array.isArray(profilesData) && profilesData.length > 0
      ? profilesData[0]
      : null

    if (!profile || profile.team !== matchedTeam.team_color) {
      return json(401, { error: 'Invalid PIN or member selection' })
    }

    const now = Math.floor(Date.now() / 1000)
    const expiresIn = 60 * 60 * 12
    const accessToken = await signHs256Jwt({
      aud: 'authenticated',
      exp: now + expiresIn,
      iat: now,
      iss: 'supabase',
      sub: profile.id,
      email: profile.email ?? `${profile.id}@pin.lumen.local`,
      role: 'authenticated',
      aal: 'aal1',
      app_metadata: {
        provider: 'team-pin',
        providers: ['team-pin'],
        role: profile.role,
      },
      user_metadata: { full_name: profile.full_name },
    }, jwtSecret)

    const deviceHash = await sha256Base64Url(`${profile.id}:${deviceId}`)
    const userAgent = sanitizeUserAgent(req.headers.get('user-agent'))
    await supabaseFetch<void>(
      supabaseUrl,
      serviceRoleKey,
      'pin_trusted_devices?on_conflict=profile_id,device_id_hash',
      {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          profile_id: profile.id,
          device_id_hash: deviceHash,
          last_seen_at: new Date().toISOString(),
          last_user_agent: userAgent,
        }),
      },
    )

    await supabaseFetch<void>(
      supabaseUrl,
      serviceRoleKey,
      `profiles?id=eq.${encodeURIComponent(profile.id)}`,
      {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({ last_pin_login_at: new Date().toISOString() }),
      },
    )

    return json(200, {
      accessToken,
      expiresAt: now + expiresIn,
      user: {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role,
        team: profile.team,
      },
    })
  } catch (error) {
    console.error('[team-pin-login] failed', error)
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
})
