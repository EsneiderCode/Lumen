import { CORS_HEADERS, env, json, selectOne, supabaseFetch } from '../_shared/http.ts'
import { hashPin, normalizeLoginCode } from '../_shared/pin.ts'

type UserRole = 'admin' | 'technician' | 'contractor'
type TeamColor = 'rot' | 'gruen' | 'blau' | 'gelb'

interface ProfileRow {
  id: string
  email: string | null
  full_name: string
  role: UserRole
  team: TeamColor | null
  is_active: boolean
  pin_login_code: string | null
  pin_set_at: string | null
  last_pin_login_at: string | null
  created_at: string
  updated_at: string
}

interface AuthUserResponse {
  id?: string
  email?: string
}

interface UserPayload {
  id?: string
  email?: string | null
  fullName?: string
  role?: UserRole
  team?: TeamColor | null
  isActive?: boolean
  pin?: string | null
  loginCode?: string | null
}

function readPayload(value: unknown): UserPayload {
  if (!value || typeof value !== 'object') return {}
  const raw = value as Record<string, unknown>
  return {
    id: typeof raw.id === 'string' ? raw.id : undefined,
    email: typeof raw.email === 'string' ? raw.email : raw.email === null ? null : undefined,
    fullName: typeof raw.fullName === 'string' ? raw.fullName : undefined,
    role: ['admin', 'technician', 'contractor'].includes(String(raw.role)) ? raw.role as UserRole : undefined,
    team: ['rot', 'gruen', 'blau', 'gelb'].includes(String(raw.team)) ? raw.team as TeamColor : raw.team === null ? null : undefined,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : undefined,
    pin: typeof raw.pin === 'string' ? raw.pin : raw.pin === null ? null : undefined,
    loginCode: typeof raw.loginCode === 'string' ? raw.loginCode : raw.loginCode === null ? null : undefined,
  }
}

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `${btoa(binary)}aA1!`
}

function syntheticEmail(loginCode: string): string {
  return `${loginCode}.${crypto.randomUUID().slice(0, 8)}@pin.lumen.local`
}

async function requireAdmin(req: Request, supabaseUrl: string, serviceRoleKey: string): Promise<Response | null> {
  const auth = req.headers.get('authorization')
  if (!auth) return json(401, { error: 'Missing authorization' })

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: auth,
    },
  })
  if (!userRes.ok) return json(401, { error: 'Invalid authorization' })

  const authUser = await userRes.json() as AuthUserResponse
  if (!authUser.id) return json(401, { error: 'Invalid authorization' })

  const profile = await selectOne<{ role: UserRole; is_active: boolean }>(
    supabaseUrl,
    serviceRoleKey,
    'profiles',
    `select=role,is_active&id=eq.${encodeURIComponent(authUser.id)}`,
  )
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return json(403, { error: 'Admin access required' })
  }
  return null
}

async function createAuthUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: Required<Pick<UserPayload, 'fullName' | 'role'>> & Pick<UserPayload, 'email'> & { loginCode: string },
): Promise<string> {
  const email = payload.email?.trim() || syntheticEmail(payload.loginCode)
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: {
        full_name: payload.fullName,
        role: payload.role,
      },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Auth user create failed (${res.status}): ${text}`)
  }
  const user = await res.json() as AuthUserResponse
  if (!user.id) throw new Error('Auth user create returned no id')
  return user.id
}

async function listUsers(supabaseUrl: string, serviceRoleKey: string): Promise<ProfileRow[]> {
  return await supabaseFetch<ProfileRow[]>(
    supabaseUrl,
    serviceRoleKey,
    'profiles?select=id,email,full_name,role,team,is_active,pin_login_code,pin_set_at,last_pin_login_at,created_at,updated_at&order=full_name',
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const supabaseUrl = env('SUPABASE_URL')
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')
    const adminError = await requireAdmin(req, supabaseUrl, serviceRoleKey)
    if (adminError) return adminError

    if (req.method === 'GET') {
      return json(200, { users: await listUsers(supabaseUrl, serviceRoleKey) })
    }

    const payload = readPayload(await req.json().catch(() => null))

    if (req.method === 'POST') {
      if (!payload.fullName?.trim() || !payload.role) {
        return json(400, { error: 'Full name and role are required' })
      }
      const loginCode = normalizeLoginCode(payload.loginCode || payload.fullName)
      if (!loginCode) return json(400, { error: 'Login code is required' })

      const id = await createAuthUser(supabaseUrl, serviceRoleKey, {
        fullName: payload.fullName.trim(),
        role: payload.role,
        email: payload.email ?? null,
        loginCode,
      })

      const profileUpdate: Record<string, unknown> = {
        id,
        email: payload.email?.trim() || null,
        full_name: payload.fullName.trim(),
        role: payload.role,
        team: payload.team ?? null,
        is_active: payload.isActive ?? true,
        pin_login_code: ['technician', 'contractor'].includes(payload.role) ? loginCode : null,
        updated_at: new Date().toISOString(),
      }
      if (payload.pin) {
        profileUpdate.pin_hash = await hashPin(payload.pin)
        profileUpdate.pin_set_at = new Date().toISOString()
      }

      await supabaseFetch<ProfileRow[]>(
        supabaseUrl,
        serviceRoleKey,
        'profiles?on_conflict=id&select=id',
        {
          method: 'POST',
          headers: { prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(profileUpdate),
        },
      )
      return json(201, { users: await listUsers(supabaseUrl, serviceRoleKey) })
    }

    if (req.method === 'PATCH') {
      if (!payload.id) return json(400, { error: 'User id is required' })

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (payload.email !== undefined) patch.email = payload.email?.trim() || null
      if (payload.fullName !== undefined) patch.full_name = payload.fullName.trim()
      if (payload.role !== undefined) patch.role = payload.role
      if (payload.team !== undefined) patch.team = payload.team
      if (payload.isActive !== undefined) patch.is_active = payload.isActive
      if (payload.loginCode !== undefined) {
        patch.pin_login_code = payload.loginCode ? normalizeLoginCode(payload.loginCode) : null
      }
      if (payload.pin) {
        patch.pin_hash = await hashPin(payload.pin)
        patch.pin_set_at = new Date().toISOString()
      }

      await supabaseFetch<void>(
        supabaseUrl,
        serviceRoleKey,
        `profiles?id=eq.${encodeURIComponent(payload.id)}`,
        {
          method: 'PATCH',
          headers: { prefer: 'return=minimal' },
          body: JSON.stringify(patch),
        },
      )
      return json(200, { users: await listUsers(supabaseUrl, serviceRoleKey) })
    }

    return json(405, { error: 'Method not allowed' })
  } catch (error) {
    console.error('[admin-users] failed', error)
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
})
