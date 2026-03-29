import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
import type { WorkOrderStatus, WorkType, TeamColor } from '@/types/enums'

type WorkOrderRow = Database['public']['Tables']['work_orders']['Row']
type WorkOrderInsert = Database['public']['Tables']['work_orders']['Insert']
type WorkOrderUpdate = Database['public']['Tables']['work_orders']['Update']

export interface WorkOrderWithRelations extends WorkOrderRow {
  clients: { name: string; code: string } | null
  projects: { name: string; code: string } | null
  operators: { name: string; code: string } | null
  assignedProfile: { full_name: string } | null
}

export interface WorkOrderFilters {
  status?: WorkOrderStatus
  team?: TeamColor
  work_type?: WorkType
  project_id?: string
  client_id?: string
  search?: string
}

// ── Lookup tables ─────────────────────────────────────────────

export async function fetchClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, code')
    .eq('is_active', true)
    .order('name')
  return { data: data ?? [], error: error?.message ?? null }
}

export async function fetchProjects(clientId?: string) {
  let query = supabase.from('projects').select('id, name, code, client_id').eq('is_active', true)
  if (clientId) query = query.eq('client_id', clientId)
  const { data, error } = await query.order('code')
  return { data: data ?? [], error: error?.message ?? null }
}

export async function fetchOperators() {
  const { data, error } = await supabase
    .from('operators')
    .select('id, name, code')
    .eq('is_active', true)
    .order('code')
  return { data: data ?? [], error: error?.message ?? null }
}

export async function fetchTechnicians() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, team')
    .eq('role', 'technician')
    .eq('is_active', true)
    .order('full_name')
  return { data: data ?? [], error: error?.message ?? null }
}

// ── Work Orders CRUD ─────────────────────────────────────────

export async function fetchWorkOrders(filters: WorkOrderFilters = {}) {
  let query = supabase
    .from('work_orders')
    .select(`
      *,
      clients ( name, code ),
      projects ( name, code ),
      operators ( name, code )
    `)
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.team) query = query.eq('assigned_team', filters.team)
  if (filters.work_type) query = query.eq('work_type', filters.work_type)
  if (filters.project_id) query = query.eq('project_id', filters.project_id)
  if (filters.client_id) query = query.eq('client_id', filters.client_id)
  if (filters.search) {
    query = query.or(
      `order_number.ilike.%${filters.search}%,address.ilike.%${filters.search}%`,
    )
  }

  const { data, error } = await query
  return { data: data ?? [], error: error?.message ?? null }
}

export async function fetchWorkOrder(id: string) {
  const { data, error } = await supabase
    .from('work_orders')
    .select(`
      *,
      clients ( name, code ),
      projects ( name, code ),
      operators ( name, code )
    `)
    .eq('id', id)
    .single()
  return { data, error: error?.message ?? null }
}

export async function createWorkOrder(
  payload: Omit<WorkOrderInsert, 'order_number' | 'created_by'>,
  userId: string,
) {
  // Generate order number: LUM-YYYYMMDD-XXXX
  const date = new Date()
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const rand = Math.floor(1000 + Math.random() * 9000)
  const order_number = `LUM-${datePart}-${rand}`

  const { data, error } = await supabase
    .from('work_orders')
    .insert({ ...payload, order_number, created_by: userId })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  // Record initial state in history
  await supabase.from('work_order_state_history').insert({
    work_order_id: data.id,
    from_status: null,
    to_status: 'created',
    changed_by: userId,
    notes: 'Auftrag erstellt',
  })

  return { data, error: null }
}

export async function updateWorkOrder(id: string, payload: WorkOrderUpdate) {
  const { data, error } = await supabase
    .from('work_orders')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error: error?.message ?? null }
}

export async function deleteWorkOrder(id: string) {
  const { error } = await supabase.from('work_orders').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ── Assignment (LUM-010) ──────────────────────────────────────

export async function assignWorkOrder(
  id: string,
  team: TeamColor,
  technicianId: string | null,
  assignedDate: string | null,
  changedBy: string,
) {
  // Fetch current status first
  const { data: current } = await supabase
    .from('work_orders')
    .select('status')
    .eq('id', id)
    .single()

  const fromStatus = current?.status ?? null

  const { data, error } = await supabase
    .from('work_orders')
    .update({
      assigned_team: team,
      assigned_technician: technicianId,
      assigned_date: assignedDate,
      status: 'assigned',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  await supabase.from('work_order_state_history').insert({
    work_order_id: id,
    from_status: fromStatus,
    to_status: 'assigned',
    changed_by: changedBy,
    notes: `Zugewiesen an Team ${team}`,
  })

  return { data, error: null }
}

// ── Detail tables ─────────────────────────────────────────────

type DetailTable =
  | 'wo_detail_soplado'
  | 'wo_detail_fusion_ap'
  | 'wo_detail_fusion_dp'
  | 'wo_detail_alta'
  | 'wo_detail_nt'
  | 'wo_detail_patchkabel'

export function workTypeToDetailTable(workType: WorkType): DetailTable {
  const map: Record<WorkType, DetailTable> = {
    soplado: 'wo_detail_soplado',
    fusion_ap: 'wo_detail_fusion_ap',
    fusion_dp: 'wo_detail_fusion_dp',
    alta: 'wo_detail_alta',
    nt_installation: 'wo_detail_nt',
    patchkabel: 'wo_detail_patchkabel',
  }
  return map[workType]
}

export async function upsertWorkOrderDetail(
  table: DetailTable,
  workOrderId: string,
  detail: Record<string, unknown>,
) {
  const { data: existing } = await supabase
    .from(table as 'wo_detail_soplado')
    .select('id')
    .eq('work_order_id', workOrderId)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from(table as 'wo_detail_soplado')
      .update(detail)
      .eq('id', existing.id)
    return { error: error?.message ?? null }
  } else {
    const { error } = await supabase
      .from(table as 'wo_detail_soplado')
      .insert({ ...detail, work_order_id: workOrderId })
    return { error: error?.message ?? null }
  }
}

export async function fetchWorkOrderDetail(table: DetailTable, workOrderId: string) {
  // Use array + limit instead of maybeSingle() to avoid errors when
  // duplicate rows exist (can happen if RLS blocked SELECT on first attempt)
  const { data, error } = await supabase
    .from(table as 'wo_detail_soplado')
    .select('*')
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: false })
    .limit(1)
  const row = data && data.length > 0 ? data[0] : null
  return { data: row, error: error?.message ?? null }
}

// ── Technician / Sprint 4 ──────────────────────────────────────

export async function fetchMyWorkOrders(userId: string, team: string | null) {
  let query = supabase
    .from('work_orders')
    .select(`
      *,
      clients ( name, code ),
      projects ( name, code ),
      operators ( name, code )
    `)
    .not('status', 'in', '("cancelled","paid","returned")')
    .order('assigned_date', { ascending: true, nullsFirst: false })

  if (team) {
    query = query.or(`assigned_technician.eq.${userId},assigned_team.eq.${team}`)
  } else {
    query = query.eq('assigned_technician', userId)
  }

  const { data, error } = await query
  return { data: data ?? [], error: error?.message ?? null }
}

export async function transitionWorkOrderStatus(
  id: string,
  toStatus: WorkOrderStatus,
  changedBy: string,
  notes?: string,
) {
  const { data: current } = await supabase
    .from('work_orders')
    .select('status')
    .eq('id', id)
    .single()

  const fromStatus = current?.status ?? null

  const { data, error } = await supabase
    .from('work_orders')
    .update({ status: toStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  await supabase.from('work_order_state_history').insert({
    work_order_id: id,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: changedBy,
    notes: notes ?? null,
  })

  return { data, error: null }
}

export async function fetchStateHistory(workOrderId: string) {
  const { data, error } = await supabase
    .from('work_order_state_history')
    .select('*')
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: true })
  return { data: data ?? [], error: error?.message ?? null }
}

export async function fetchWorkOrderPhotos(workOrderId: string) {
  const { data, error } = await supabase
    .from('work_order_photos')
    .select('*')
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: true })
  return { data: data ?? [], error: error?.message ?? null }
}

export async function uploadWorkOrderPhoto(
  workOrderId: string,
  photoType: 'before' | 'during' | 'after',
  file: File,
  userId: string,
) {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `${Date.now()}.${ext}`
  const storagePath = `${workOrderId}/${photoType}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from('work-order-photos')
    .upload(storagePath, file, { contentType: file.type })

  if (uploadError) return { data: null, error: uploadError.message }

  const { data, error } = await supabase
    .from('work_order_photos')
    .insert({
      work_order_id: workOrderId,
      storage_path: storagePath,
      photo_type: photoType,
      uploaded_by: userId,
    })
    .select()
    .single()

  return { data, error: error?.message ?? null }
}

export function getPhotoPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from('work-order-photos').getPublicUrl(storagePath)
  return data.publicUrl
}
