import { supabase } from '@/lib/supabase'

export interface ProjectClientRef {
  id: string
  code: string
  name: string
}

export interface Project {
  id: string
  code: string
  name: string
  client_id: string | null
  default_operator_id: string | null
  default_line: 'NE3' | 'NE4' | null
  /** Readable label of the project's locality (QFF → Roßdorf). */
  city: string | null
  /** Where the technician's map opens before a trench has a position. */
  center_lat: number | null
  center_lng: number | null
  is_active: boolean
  created_at: string
  clients: ProjectClientRef | null
}

export interface ProjectInput {
  code: string
  name: string
  client_id: string | null
  default_operator_id?: string | null
  default_line?: 'NE3' | 'NE4' | null
  city?: string | null
  center_lat?: number | null
  center_lng?: number | null
}

export interface ProjectMetrics {
  total: number
  active: number
  completed: number
  cancelled: number
}

export interface ProjectWorkOrderRow {
  id: string
  order_number: string | null
  status: string
  assigned_team: string | null
  created_at: string
  clients: { name: string } | null
}

interface FetchOpts {
  includeInactive?: boolean
  search?: string
}

export async function listProjects(opts: FetchOpts = {}): Promise<{ data: Project[]; error: string | null }> {
  let query = supabase
    .from('projects')
    .select('*, clients(id, code, name)')
    .order('code', { ascending: true })

  if (!opts.includeInactive) {
    query = query.eq('is_active', true)
  }
  if (opts.search?.trim()) {
    const term = opts.search.trim()
    query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%`)
  }

  const { data, error } = await query
  return { data: (data as Project[] | null) ?? [], error: error?.message ?? null }
}

export async function getProject(id: string): Promise<{ data: Project | null; error: string | null }> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(id, code, name)')
    .eq('id', id)
    .single()
  return { data: (data as Project | null) ?? null, error: error?.message ?? null }
}

function normalizeInput(input: ProjectInput): ProjectInput {
  return {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    client_id: input.client_id || null,
    default_operator_id: input.default_operator_id || null,
    default_line: input.default_line || null,
    city: input.city?.trim() || null,
    // Both or neither: half a coordinate centres nothing, and the DB check
    // (migration 060) rejects it anyway.
    center_lat: typeof input.center_lat === 'number' ? input.center_lat : null,
    center_lng: typeof input.center_lng === 'number' ? input.center_lng : null,
  }
}

export async function createProject(input: ProjectInput): Promise<{ data: Project | null; error: string | null }> {
  const payload = normalizeInput(input)
  if (!payload.code || !payload.name) {
    return { data: null, error: 'Code und Name sind erforderlich.' }
  }
  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select('*, clients(id, code, name)')
    .single()
  return { data: (data as Project | null) ?? null, error: error?.message ?? null }
}

export async function updateProject(
  id: string,
  input: ProjectInput,
): Promise<{ data: Project | null; error: string | null }> {
  const payload = normalizeInput(input)
  if (!payload.code || !payload.name) {
    return { data: null, error: 'Code und Name sind erforderlich.' }
  }
  const { data, error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', id)
    .select('*, clients(id, code, name)')
    .single()
  return { data: (data as Project | null) ?? null, error: error?.message ?? null }
}

export async function deactivateProject(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('projects').update({ is_active: false }).eq('id', id)
  return { error: error?.message ?? null }
}

export async function reactivateProject(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('projects').update({ is_active: true }).eq('id', id)
  return { error: error?.message ?? null }
}

const COMPLETED_STATUSES = new Set(['invoiced', 'paid'])
const CANCELLED_STATUSES = new Set(['cancelled'])

export async function getProjectMetrics(
  projectId: string,
): Promise<{ data: ProjectMetrics | null; error: string | null }> {
  const { data, error } = await supabase
    .from('work_orders')
    .select('status')
    .eq('project_id', projectId)

  if (error) return { data: null, error: error.message }

  const rows = (data ?? []) as Array<{ status: string }>
  let completed = 0
  let cancelled = 0
  for (const row of rows) {
    if (COMPLETED_STATUSES.has(row.status)) completed++
    else if (CANCELLED_STATUSES.has(row.status)) cancelled++
  }
  return {
    data: {
      total: rows.length,
      active: rows.length - completed - cancelled,
      completed,
      cancelled,
    },
    error: null,
  }
}

export async function listProjectWorkOrders(
  projectId: string,
  limit = 50,
): Promise<{ data: ProjectWorkOrderRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('work_orders')
    .select('id, order_number, status, assigned_team, created_at, clients(name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data: (data as ProjectWorkOrderRow[] | null) ?? [], error: error?.message ?? null }
}
