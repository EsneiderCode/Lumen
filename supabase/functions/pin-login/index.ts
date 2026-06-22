import { CORS_HEADERS, env, json, selectOne, supabaseFetch } from '../_shared/http.ts'
import { sanitizeUserAgent, sha256Base64Url, verifyPin } from '../_shared/pin.ts'
import { signHs256Jwt } from '../_shared/jwt.ts'

interface ProfileRow {
  id: string
  email: string | null
  full_name: string
  role: 'admin' | 'technician' | 'contractor'
  team: string | null
  is_active: boolean
  pin_hash: string | null
  pin_login_code: string | null
}

interface LoginBody {
  loginCode?: string
  pin?: string
  deviceId?: string
}

function readBody(value: unknown): LoginBody {
  if (!value || typeof value !== 'object') return {}
  const body = value as Record<string, unknown>
  return {
    loginCode: typeof body.loginCode === 'string' ? body.loginCode : undefined,
    pin: typeof body.pin === 'string' ? body.pin : undefined,
    deviceId: typeof body.deviceId === 'string' ? body.deviceId : undefined,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const supabaseUrl = env('SUPABASE_URL')
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')
    const jwtSecret = env('JWT_SECRET')

    const body = readBody(await req.json().catch(() => null))
    const loginCode = body.loginCode?.trim().toLowerCase()
    const pin = body.pin?.trim()
    const deviceId = body.deviceId?.trim()

    if (!loginCode || !pin || !deviceId) {
      return json(400, { error: 'Login code, PIN and device id are required' })
    }

    // Reject login codes containing LIKE wildcards or unexpected characters.
    // Returns the same generic 401 as an invalid login to avoid leaking existence.
    if (!/^[a-z0-9._-]+$/.test(loginCode)) {
      return json(401, { error: 'Invalid PIN credentials' })
    }

    const profile = await selectOne<ProfileRow>(
      supabaseUrl,
      serviceRoleKey,
      'profiles',
      `select=id,email,full_name,role,team,is_active,pin_hash,pin_login_code&pin_login_code=eq.${encodeURIComponent(loginCode)}`,
    )

    if (!profile || !profile.is_active || !['technician', 'contractor'].includes(profile.role)) {
      return json(401, { error: 'Invalid PIN credentials' })
    }

    const ok = await verifyPin(pin, profile.pin_hash)
    if (!ok) return json(401, { error: 'Invalid PIN credentials' })

    const now = Math.floor(Date.now() / 1000)
    const expiresIn = 60 * 60 * 12
    const accessToken = await signHs256Jwt({
      aud: 'authenticated',
      exp: now + expiresIn,
      iat: now,
      iss: 'supabase',
      sub: profile.id,
      email: profile.email ?? `${profile.pin_login_code}@pin.lumen.local`,
      role: 'authenticated',
      aal: 'aal1',
      app_metadata: {
        provider: 'pin',
        providers: ['pin'],
        role: profile.role,
      },
      user_metadata: {
        full_name: profile.full_name,
      },
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
        loginCode: profile.pin_login_code,
      },
    })
  } catch (error) {
    console.error('[pin-login] failed', error)
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
})
