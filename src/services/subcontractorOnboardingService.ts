import { supabase } from '@/lib/supabase'
import type {
  SubcontractorOnboarding,
  SubcontractorOnboardingPayload,
} from '@/types/subcontractor-onboarding'

const TABLE = 'subcontractor_onboarding'

// The `subcontractor_onboarding` table is added by migration 033; it only appears
// in the generated database.types.ts after Alejandro applies the migration and
// regenerates types. Until then, access it through an untyped client view.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any }

/** Normalize payload before persisting: empty strings → null, keep booleans/arrays. */
function toRow(payload: SubcontractorOnboardingPayload) {
  const nullable = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)
  return {
    contractor_id: payload.contractor_id,
    company_name: nullable(payload.company_name),
    ust_id_es: nullable(payload.ust_id_es),
    address: nullable(payload.address),
    tax_number_de: nullable(payload.tax_number_de),
    contact_person: nullable(payload.contact_person),
    contact_email: nullable(payload.contact_email),
    contact_phone: nullable(payload.contact_phone),
    project_site: nullable(payload.project_site),
    deployment_period: nullable(payload.deployment_period),
    a1_workers: payload.a1_workers.filter((w) => w.name.trim() || w.id_number.trim()),
    checked_48b: payload.checked_48b,
    withhold_bauabzug: payload.withhold_bauabzug,
    ust_id_confirmed: payload.ust_id_confirmed,
    place_date: nullable(payload.place_date),
    verified_by: nullable(payload.verified_by),
    notes: nullable(payload.notes),
  }
}

export async function fetchSubcontractorOnboarding(contractorId: string) {
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('contractor_id', contractorId)
    .maybeSingle()
  return {
    data: (data as SubcontractorOnboarding | null) ?? null,
    error: error?.message ?? null,
  }
}

/**
 * Insert-or-update the onboarding record for a contractor (one row per contractor).
 * Done as fetch-then-write so it works both against Supabase and the demo mock,
 * which has no `.upsert()`.
 */
export async function saveSubcontractorOnboarding(
  payload: SubcontractorOnboardingPayload,
  savedBy: string,
) {
  const row = toRow(payload)

  const { data: existing, error: findErr } = await db
    .from(TABLE)
    .select('id')
    .eq('contractor_id', payload.contractor_id)
    .maybeSingle()

  if (findErr) return { data: null, error: findErr.message }

  if (existing) {
    const { data, error } = await db
      .from(TABLE)
      .update(row)
      .eq('id', (existing as { id: string }).id)
      .select()
      .single()
    return { data: data as SubcontractorOnboarding | null, error: error?.message ?? null }
  }

  const { data, error } = await db
    .from(TABLE)
    .insert({ ...row, created_by: savedBy })
    .select()
    .single()
  return { data: data as SubcontractorOnboarding | null, error: error?.message ?? null }
}
