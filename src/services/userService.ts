import { supabase } from '@/lib/supabase'
import type { TeamColor, UserRole } from '@/types/enums'

export interface OperationalUser {
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

export interface OperationalUserPayload {
  id?: string
  email?: string | null
  fullName?: string
  role?: UserRole
  team?: TeamColor | null
  isActive?: boolean
}

function errorMessage(error: unknown): string | null {
  if (!error) return null
  if (error instanceof Error) return error.message
  return String(error)
}

export async function fetchOperationalUsers() {
  const { data, error } = await supabase.functions.invoke<{ users: OperationalUser[] }>('admin-users', {
    method: 'GET',
  })
  if (error) console.error('[userService] admin-users error:', error)
  return { data: data?.users ?? [], error: errorMessage(error) }
}

export async function createOperationalUser(payload: OperationalUserPayload) {
  const { data, error } = await supabase.functions.invoke<{ users: OperationalUser[] }>('admin-users', {
    method: 'POST',
    body: payload,
  })
  return { data: data?.users ?? [], error: errorMessage(error) }
}

export async function updateOperationalUser(payload: OperationalUserPayload & { id: string }) {
  const { data, error } = await supabase.functions.invoke<{ users: OperationalUser[] }>('admin-users', {
    method: 'PATCH',
    body: payload,
  })
  return { data: data?.users ?? [], error: errorMessage(error) }
}
