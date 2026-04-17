import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
import type { WorkOrderStatus, WorkType, TeamColor, UserRole } from '@/types/enums'

// ── State machine ──────────────────────────────────────────────────────────

/**
 * Canonical valid transitions for the work order state machine.
 * Any transition not listed here is illegal.
 */
export const VALID_TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  created:              ['assigned', 'cancelled'],
  assigned:             ['in_progress', 'cancelled'],
  in_progress:          ['executed', 'cancelled'],
  executed:             ['rueckmeldung_pending', 'cancelled'],
  rueckmeldung_pending: ['rueckmeldung_sent', 'cancelled'],
  rueckmeldung_sent:    ['internally_certified', 'returned', 'cancelled'],
  internally_certified: ['sent_to_client', 'cancelled'],
  sent_to_client:       ['client_accepted', 'client_rejected'],
  client_accepted:      ['invoiced'],
  client_rejected:      ['internally_certified'],
  invoiced:             ['paid'],
  returned:             ['rueckmeldung_pending'],
  paid:                 [],
  cancelled:            [],
}

/**
 * Statuses that only an admin may transition to.
 * Technicians are limited to the field-reporting portion of the pipeline.
 */
const ADMIN_ONLY_TARGETS = new Set<WorkOrderStatus>([
  'internally_certified',
  'sent_to_client',
  'client_accepted',
  'client_rejected',
  'invoiced',
  'paid',
  'returned',
  'cancelled',
])

/**
 * Validates a proposed status transition.
 * Returns an error string if invalid, or null if allowed.
 */
export function validateStatusTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  userRole?: UserRole,
): string | null {
  const allowed = VALID_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    return `Ungültiger Statusübergang: ${from} → ${to}`
  }
  if (userRole && userRole !== 'admin' && ADMIN_ONLY_TARGETS.has(to)) {
    return `Keine Berechtigung: Nur Admins können den Status auf "${to}" setzen`
  }
  return null
}

type WorkOrderRow = Database['public']['Tables']['work_orders']['Row']
type WorkOrderInsert = Database['public']['Tables']['work_orders']['Insert']
type WorkOrderUpdate = Database['public']['Tables']['work_orders']['Update']

export interface WorkOrderWithRelations extends WorkOrderRow {
  clients: { name: string; code: string } | null
  projects: { name: string; code: string } | null
  operators: { name: string; code: string } | null
  assignedProfile?: { full_name: string } | null
  // Added in migration 002; not yet reflected in database.types.ts
  assigned_detail_snapshot?: Record<string, unknown> | null
  // Added in service_catalog_v1 migration
  service_item_id?: string | null
  service_items?: {
    id: string
    code: string
    description_de: string
    description_es: string | null
    unit: string | null
    unit_price: number | null
    detail_form: string | null
  } | null
}

export interface WorkOrderFilters {
  status?: WorkOrderStatus
  team?: TeamColor
  work_type?: WorkType
  project_id?: string
  client_id?: string
  search?: string
  date_from?: string // ISO date YYYY-MM-DD
  date_to?: string   // ISO date YYYY-MM-DD
  priority?: 'normal' | 'alta' | 'urgente'
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

export async function fetchWorkOrders(
  filters: WorkOrderFilters = {},
  page = 0,
  pageSize = 25,
) {
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('work_orders')
    .select(`
      *,
      clients ( name, code ),
      projects ( name, code ),
      operators ( name, code )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.team) query = query.eq('assigned_team', filters.team)
  if (filters.work_type) query = query.eq('work_type', filters.work_type)
  if (filters.project_id) query = query.eq('project_id', filters.project_id)
  if (filters.client_id) query = query.eq('client_id', filters.client_id)
  if (filters.search) {
    // Strip PostgREST operator characters to prevent filter-string injection
    const term = filters.search.replace(/[.,()]/g, '')
    query = query.or(
      `order_number.ilike.%${term}%,address.ilike.%${term}%`,
    )
  }
  if (filters.date_from) query = query.gte('assigned_date', filters.date_from)
  if (filters.date_to) query = query.lte('assigned_date', filters.date_to)
  if (filters.priority) query = query.eq('priority', filters.priority)

  const { data, error, count } = await query
  return {
    data: (data ?? []) as unknown as WorkOrderWithRelations[],
    total: count ?? 0,
    error: error?.message ?? null,
  }
}

export async function fetchWorkOrder(id: string) {
  const { data, error } = await supabase
    .from('work_orders')
    .select(`
      *,
      clients ( name, code ),
      projects ( name, code ),
      operators ( name, code ),
      service_items ( id, code, description_de, description_es, unit, unit_price, detail_form )
    `)
    .eq('id', id)
    .single()
  return { data: data as unknown as WorkOrderWithRelations | null, error: error?.message ?? null }
}

export async function createWorkOrder(
  payload: Omit<WorkOrderInsert, 'order_number' | 'created_by'>,
  userId: string,
) {
  // Generate order number atomically via DB sequence (migration 003)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: seqData, error: seqError } = await (supabase as any).rpc('generate_order_number')
  if (seqError || !seqData) {
    return { data: null, error: seqError?.message ?? 'Auftragsnummer konnte nicht generiert werden' }
  }
  const order_number = seqData as string

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

export async function fetchMyWorkOrders(
  userId: string,
  team: string | null,
  page = 0,
  pageSize = 20,
) {
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('work_orders')
    .select(`
      *,
      clients ( name, code ),
      projects ( name, code ),
      operators ( name, code )
    `, { count: 'exact' })
    .not('status', 'in', '("cancelled","paid")')
    .order('assigned_date', { ascending: true, nullsFirst: false })
    .range(from, to)

  if (team) {
    query = query.or(`assigned_technician.eq.${userId},assigned_team.eq.${team}`)
  } else {
    query = query.eq('assigned_technician', userId)
  }

  const { data, error, count } = await query
  return {
    data: (data ?? []) as unknown as WorkOrderWithRelations[],
    total: count ?? 0,
    error: error?.message ?? null,
  }
}

export async function transitionWorkOrderStatus(
  id: string,
  toStatus: WorkOrderStatus,
  changedBy: string,
  notes?: string,
  userRole?: UserRole,
) {
  const { data: current } = await supabase
    .from('work_orders')
    .select('status')
    .eq('id', id)
    .single()

  const fromStatus = current?.status ?? null

  if (fromStatus) {
    const validationError = validateStatusTransition(fromStatus as WorkOrderStatus, toStatus, userRole)
    if (validationError) return { data: null, error: validationError }
  }

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
    .select('*, profiles ( full_name )')
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: true })
  return { data: data ?? [], error: error?.message ?? null }
}

// ── Contractor (LUM-019) ──────────────────────────────────────

export async function fetchContractorWorkOrders(userId: string) {
  const { data, error } = await supabase
    .from('work_orders')
    .select(`
      *,
      clients ( name, code ),
      projects ( name, code ),
      operators ( name, code )
    `)
    .eq('assigned_technician', userId)
    .order('assigned_date', { ascending: false, nullsFirst: false })
  return { data: (data ?? []) as unknown as WorkOrderWithRelations[], error: error?.message ?? null }
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

/** Returns a short-lived signed URL (1 hour) for a single photo. */
export async function getPhotoSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('work-order-photos')
    .createSignedUrl(storagePath, expiresIn)
  if (error || !data) return ''
  return data.signedUrl
}

/**
 * Batch-resolves signed URLs for multiple photos.
 * Returns a map of storagePath → signedUrl.
 */
export async function getPhotoSignedUrls(
  storagePaths: string[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {}
  const { data, error } = await supabase.storage
    .from('work-order-photos')
    .createSignedUrls(storagePaths, expiresIn)
  if (error || !data) return {}
  return Object.fromEntries(
    data
      .filter((item) => item.signedUrl)
      .map((item) => [item.path, item.signedUrl]),
  )
}

export async function deleteWorkOrderPhoto(photoId: string, storagePath: string) {
  const { error: storageError } = await supabase.storage
    .from('work-order-photos')
    .remove([storagePath])
  if (storageError) return { error: storageError.message }

  const { error: dbError } = await supabase
    .from('work_order_photos')
    .delete()
    .eq('id', photoId)
  return { error: dbError?.message ?? null }
}

// ── Sprint 7 — Certification Review (LUM-023 / LUM-024) ──────────────────

/**
 * LUM-023: Save the admin-assigned detail snapshot once on order creation.
 * Uses .is('assigned_detail_snapshot', null) guard — never overwrites.
 */
export async function saveAssignedDetailSnapshot(
  workOrderId: string,
  detail: Record<string, unknown>,
) {
  const { error } = await supabase
    .from('work_orders')
    .update({ assigned_detail_snapshot: detail } as never)
    .eq('id', workOrderId)
    .is('assigned_detail_snapshot', null)
  return { error: error?.message ?? null }
}

/**
 * LUM-024: Generate a SHA-256 hex digest of the provided data object.
 * Keys are sorted for determinism. Used for certification audit hashes.
 */
export async function generateDataHash(data: Record<string, unknown>): Promise<string> {
  const str = JSON.stringify(data, Object.keys(data).sort())
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * LUM-024: Insert a certification audit record.
 */
export async function insertCertificationAudit(
  workOrderId: string,
  certType: 'internal' | 'client',
  certifiedBy: string,
  dataHash: string,
  notes?: string,
) {
  const { error } = await supabase
    .from('certification_audits' as 'work_orders') // cast — table added in migration 002
    .insert({
      work_order_id: workOrderId,
      cert_type: certType,
      certified_by: certifiedBy,
      data_hash: dataHash,
      notes: notes ?? null,
    } as never)
  return { error: error?.message ?? null }
}

/**
 * LUM-024: Fetch all certification audits for a work order.
 */
export async function fetchCertificationAudits(workOrderId: string) {
  const { data, error } = await supabase
    .from('certification_audits' as 'work_orders') // cast — table added in migration 002
    .select('*, profiles ( full_name )')
    .eq('work_order_id', workOrderId)
    .order('certified_at', { ascending: true })
  return {
    data: (data ?? []) as unknown as Array<{
      id: string
      cert_type: 'internal' | 'client'
      certified_at: string
      data_hash: string
      notes: string | null
      profiles: { full_name: string } | null
    }>,
    error: error?.message ?? null,
  }
}
