import { CORS_HEADERS, env, json, selectOne, supabaseFetch } from '../_shared/http.ts'
import { assertValidPin, hashPin, verifyPin } from '../_shared/pin.ts'

interface ProfileRow {
  id: string
  role: 'admin' | 'technician' | 'contractor'
  is_active: boolean
  pin_hash: string | null
}

interface UpdatePinBody {
  currentPin?: string
  newPin?: string
}

function readBody(value: unknown): UpdatePinBody {
  if (!value || typeof value !== 'object') return {}
  const body = value as Record<string, unknown>
  return {
    currentPin: typeof body.currentPin === 'string' ? body.currentPin : undefined,
    newPin: typeof body.newPin === 'string' ? body.newPin : undefined,
  }
}

function decodeJwtSub(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const supabaseUrl = env('SUPABASE_URL')
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')

    const userId = decodeJwtSub(req.headers.get('Authorization'))
    if (!userId) {
      return json(401, { error: 'Authorization erforderlich.' })
    }

    const body = readBody(await req.json().catch(() => null))
    const currentPin = body.currentPin?.trim()
    const newPin = body.newPin?.trim()

    if (!currentPin || !newPin) {
      return json(400, { error: 'Aktuelle PIN und neue PIN erforderlich.' })
    }

    try {
      assertValidPin(newPin)
    } catch (err) {
      return json(400, { error: err instanceof Error ? err.message : 'Ungültige PIN.' })
    }

    const profile = await selectOne<ProfileRow>(
      supabaseUrl,
      serviceRoleKey,
      'profiles',
      `select=id,role,is_active,pin_hash&id=eq.${encodeURIComponent(userId)}`,
    )

    if (!profile || !profile.is_active || !['technician', 'contractor'].includes(profile.role)) {
      return json(403, { error: 'PIN-Änderung für diesen Account nicht erlaubt.' })
    }

    const currentValid = await verifyPin(currentPin, profile.pin_hash)
    if (!currentValid) {
      return json(401, { error: 'Aktuelle PIN ungültig.' })
    }

    const newHash = await hashPin(newPin)

    await supabaseFetch<void>(
      supabaseUrl,
      serviceRoleKey,
      `profiles?id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({ pin_hash: newHash, pin_set_at: new Date().toISOString() }),
      },
    )

    return json(200, { ok: true })
  } catch (error) {
    console.error('[update-pin] failed', error)
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
})
