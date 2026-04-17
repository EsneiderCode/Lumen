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
