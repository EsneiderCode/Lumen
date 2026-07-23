import { CORS_HEADERS, env, json, selectOne, supabaseFetch, userIdFromJwt } from '../_shared/http.ts'
import { normalizeLoginCode } from '../_shared/pin.ts'

type UserRole = 'admin' | 'technician' | 'contractor' | 'scheduler'
type TeamColor =
  | 'rot' | 'gruen' | 'blau' | 'gelb'
  | 'weiss' | 'grau' | 'braun' | 'violett'
  | 'tuerkis' | 'schwarz' | 'orange' | 'rosa'

const VALID_ROLES: UserRole[] = ['admin', 'technician', 'contractor', 'scheduler']
const VALID_TEAMS: TeamColor[] = [
  'rot', 'gruen', 'blau', 'gelb',
  'weiss', 'grau', 'braun', 'violett',
  'tuerkis', 'schwarz', 'orange', 'rosa',
]

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
  action?: string
  id?: string
  email?: string | null
  fullName?: string
  password?: string
  role?: UserRole
  team?: TeamColor | null
  isActive?: boolean
}

function readPayload(value: unknown): UserPayload {
  if (!value || typeof value !== 'object') return {}
  const raw = value as Record<string, unknown>
  return {
    action: typeof raw.action === 'string' ? raw.action : undefined,
    id: typeof raw.id === 'string' ? raw.id : undefined,
    email: typeof raw.email === 'string' ? raw.email : raw.email === null ? null : undefined,
    fullName: typeof raw.fullName === 'string' ? raw.fullName : undefined,
    password: typeof raw.password === 'string' ? raw.password : undefined,
    role: VALID_ROLES.includes(String(raw.role) as UserRole) ? raw.role as UserRole : undefined,
    team: VALID_TEAMS.includes(String(raw.team) as TeamColor) ? raw.team as TeamColor : raw.team === null ? null : undefined,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : undefined,
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

// Dynamic-RBAC gate (migration 034): the caller needs the given users.*
// permission. Falls back to the legacy admin-role check when the RPC does not
// exist yet (migration not applied).
async function requirePermission(
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
  permission: string,
): Promise<Response | null> {
  const auth = req.headers.get('authorization')
  if (!auth) return json(401, { error: 'Missing authorization' })

  const userId = userIdFromJwt(auth)
  if (!userId) return json(401, { error: 'Invalid authorization' })

  try {
    const allowed = await supabaseFetch<boolean>(
      supabaseUrl,
      serviceRoleKey,
      'rpc/user_has_permission',
      { method: 'POST', body: JSON.stringify({ uid: userId, perm: permission }) },
    )
    if (allowed !== true) return json(403, { error: `Permission required: ${permission}` })
    return null
  } catch {
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
}

function requiredPermissionFor(req: Request, action: string | undefined): string {
  if (req.method === 'GET') return 'users.view'
  if (req.method === 'PATCH') return 'users.edit'
  if (action === 'delete') return 'users.delete'
  return 'users.create'
}

async function createAuthUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: Required<Pick<UserPayload, 'fullName' | 'role'>> & Pick<UserPayload, 'email' | 'password'> & { loginCode: string },
): Promise<string> {
  const email = payload.email?.trim() || syntheticEmail(payload.loginCode)  // loginCode used only for synthetic email
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: payload.password || randomPassword(),
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

    if (req.method === 'GET') {
      const gateError = await requirePermission(req, supabaseUrl, serviceRoleKey, 'users.view')
      if (gateError) return gateError
      return json(200, { users: await listUsers(supabaseUrl, serviceRoleKey) })
    }

    const payload = readPayload(await req.json().catch(() => null))
    const gateError = await requirePermission(
      req,
      supabaseUrl,
      serviceRoleKey,
      requiredPermissionFor(req, payload.action),
    )
    if (gateError) return gateError

    if (req.method === 'POST' && payload.action === 'delete') {
      if (!payload.id) return json(400, { error: 'User id is required' })

      // Delete profile row first (FK constraints)
      await supabaseFetch<void>(
        supabaseUrl,
        serviceRoleKey,
        `profiles?id=eq.${encodeURIComponent(payload.id)}`,
        { method: 'DELETE', headers: { prefer: 'return=minimal' } },
      )

      // Delete auth user
      const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(payload.id)}`, {
        method: 'DELETE',
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
        },
      })
      if (!authRes.ok) {
        const text = await authRes.text()
        console.warn(`[admin-users] auth user delete failed (${authRes.status}): ${text}`)
      }

      return json(200, { users: await listUsers(supabaseUrl, serviceRoleKey) })
    }

    if (req.method === 'POST') {
      if (!payload.fullName?.trim() || !payload.role) {
        return json(400, { error: 'Full name and role are required' })
      }
      const loginCode = normalizeLoginCode(payload.fullName)
      if (!loginCode) return json(400, { error: 'Full name is required to generate login code' })

      const id = await createAuthUser(supabaseUrl, serviceRoleKey, {
        fullName: payload.fullName.trim(),
        role: payload.role,
        email: payload.email ?? null,
        password: payload.password,
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

      // Update auth user password if provided
      if (payload.password) {
        const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(payload.id)}`, {
          method: 'PUT',
          headers: {
            apikey: serviceRoleKey,
            authorization: `Bearer ${serviceRoleKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ password: payload.password }),
        })
        if (!authRes.ok) {
          const text = await authRes.text()
          throw new Error(`Password update failed (${authRes.status}): ${text}`)
        }
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
