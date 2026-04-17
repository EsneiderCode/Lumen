/**
 * Service catalog item — rate-card entry from an operator contract.
 *
 * Backed by `public.service_items` (migration `service_catalog_v1`).
 * Codes are preserved literally (including typos such as CONECTING /
 * INSTALATION) because they match line items on operator invoices and
 * must not drift from the source contract.
 */
export interface ServiceItem {
  id: string
  code: string
  description_de: string
  description_es: string | null
  unit: string | null
  unit_price: number | null
  operator_id: string | null
  client_id: string | null
  /** Which wo_detail_* table this item routes to; maps to legacy WorkType. */
  detail_form: 'soplado' | 'fusion_ap' | 'fusion_dp' | 'alta' | 'nt' | 'patchkabel' | 'pop' | null
  display_order: number
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

/** Select shape with joined operator/client names for list views. */
export interface ServiceItemWithRelations extends ServiceItem {
  operators: { id: string; code: string; name: string } | null
  clients: { id: string; code: string; name: string } | null
}
