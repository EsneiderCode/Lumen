import { supabase } from '@/lib/supabase'
import type { ServiceItem, ServiceItemWithRelations } from '@/types/service-items'

/**
 * Fetch active service items, optionally filtered by operator.
 * Returns items ordered by display_order, then code.
 */
export async function fetchServiceItems(
  options: { operatorId?: string | null; includeInactive?: boolean } = {},
): Promise<{ data: ServiceItemWithRelations[]; error: string | null }> {
  let query = supabase
    .from('service_items')
    .select(`
      *,
      operators:operator_id (id, code, name),
      clients:client_id (id, code, name)
    `)
    .order('display_order', { ascending: true })
    .order('code', { ascending: true })

  if (!options.includeInactive) {
    query = query.eq('active', true)
  }

  if (options.operatorId !== undefined) {
    // null or set — both are valid filters
    query = options.operatorId === null
      ? query.is('operator_id', null)
      : query.or(`operator_id.eq.${options.operatorId},operator_id.is.null`)
  }

  const { data, error } = await query
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as unknown as ServiceItemWithRelations[], error: null }
}

/** Fetch a single service item by id. */
export async function fetchServiceItem(
  id: string,
): Promise<{ data: ServiceItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from('service_items')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: data as ServiceItem, error: null }
}

export type ServiceItemPayload = Omit<ServiceItem, 'id' | 'created_at' | 'updated_at'>

/** Create a new service item. */
export async function createServiceItem(
  payload: ServiceItemPayload,
): Promise<{ data: ServiceItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from('service_items')
    .insert(payload as never)
    .select()
    .single()
  if (error) return { data: null, error: error.message }
  return { data: data as ServiceItem, error: null }
}

/** Update an existing service item. */
export async function updateServiceItem(
  id: string,
  payload: Partial<ServiceItemPayload>,
): Promise<{ data: ServiceItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from('service_items')
    .update(payload as never)
    .eq('id', id)
    .select()
    .single()
  if (error) return { data: null, error: error.message }
  return { data: data as ServiceItem, error: null }
}

/** Soft-delete: set active = false. */
export async function deactivateServiceItem(
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('service_items')
    .update({ active: false })
    .eq('id', id)
  return { error: error?.message ?? null }
}

/** Re-activate a previously deactivated item. */
export async function activateServiceItem(
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('service_items')
    .update({ active: true })
    .eq('id', id)
  return { error: error?.message ?? null }
}

/** Hard-delete a service item (use with caution — prefer deactivate). */
export async function deleteServiceItem(
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('service_items')
    .delete()
    .eq('id', id)
  return { error: error?.message ?? null }
}
