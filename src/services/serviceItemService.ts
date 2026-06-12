import { supabase } from '@/lib/supabase'
import type { ServiceItem, ServiceItemWithRelations } from '@/types/service-items'

type PublicServiceItemRow = Omit<ServiceItem, 'unit_price' | 'unit_price_external'> & {
  operator_code: string | null
  operator_name: string | null
  client_code: string | null
  client_name: string | null
}

/**
 * Fetch service items.
 *
 * By default this uses the non-priced public catalog view so field users can
 * select executed work without receiving rate-card amounts in the browser.
 * Admin-only catalog/accounting screens must opt into includePrices.
 */
export async function fetchServiceItems(
  options: { operatorId?: string | null; includeInactive?: boolean; includePrices?: boolean } = {},
): Promise<{ data: ServiceItemWithRelations[]; error: string | null }> {
  if (!options.includePrices) {
    let query = supabase
      .from('service_items_public' as 'service_items')
      .select('*')
      .order('display_order', { ascending: true })
      .order('code', { ascending: true })

    if (options.operatorId !== undefined) {
      query = options.operatorId === null
        ? query.is('operator_id', null)
        : query.or(`operator_id.eq.${options.operatorId},operator_id.is.null`)
    }

    const { data, error } = await query
    if (error) return { data: [], error: error.message }

    return {
      data: ((data ?? []) as unknown as PublicServiceItemRow[]).map((row) => ({
        id: row.id,
        code: row.code,
        description_de: row.description_de,
        description_es: row.description_es,
        unit: row.unit,
        unit_price: null,
        unit_price_external: null,
        category: row.category,
        operator_id: row.operator_id,
        client_id: row.client_id,
        detail_form: row.detail_form,
        display_order: row.display_order,
        active: row.active,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        operators: row.operator_id ? { id: row.operator_id, code: row.operator_code ?? '', name: row.operator_name ?? '' } : null,
        clients: row.client_id ? { id: row.client_id, code: row.client_code ?? '', name: row.client_name ?? '' } : null,
      })),
      error: null,
    }
  }

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
  options: { includePrices?: boolean } = {},
): Promise<{ data: ServiceItem | null; error: string | null }> {
  const itemColumns = options.includePrices
    ? '*'
    : 'id, code, description_de, description_es, unit, category, operator_id, client_id, detail_form, display_order, active, notes, created_at, updated_at'

  const { data, error } = await supabase
    .from(options.includePrices ? 'service_items' : 'service_items_public' as 'service_items')
    .select(itemColumns)
    .eq('id', id)
    .single()
  if (error) return { data: null, error: error.message }
  return {
    data: {
      ...(data as unknown as Omit<ServiceItem, 'unit_price' | 'unit_price_external'>),
      unit_price: options.includePrices ? (data as unknown as ServiceItem).unit_price : null,
      unit_price_external: options.includePrices ? (data as unknown as ServiceItem).unit_price_external : null,
    } as ServiceItem,
    error: null,
  }
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

export interface ServiceItemGroup<T extends ServiceItem> {
  category: string | null
  items: T[]
}

/**
 * Group service items by their `category` field, preserving the existing
 * order within each group (items arrive pre-sorted by display_order, code).
 * Groups are ordered by first occurrence. The uncategorized group (null
 * category) is always last.
 */
export function groupServiceItemsByCategory<T extends ServiceItem>(
  items: T[],
): ServiceItemGroup<T>[] {
  const map = new Map<string, ServiceItemGroup<T>>()
  let nullGroup: ServiceItemGroup<T> | null = null

  for (const item of items) {
    if (item.category === null) {
      nullGroup ??= { category: null, items: [] }
      nullGroup.items.push(item)
      continue
    }
    let group = map.get(item.category)
    if (!group) {
      group = { category: item.category, items: [] }
      map.set(item.category, group)
    }
    group.items.push(item)
  }

  const groups = Array.from(map.values())
  if (nullGroup) groups.push(nullGroup)
  return groups
}
