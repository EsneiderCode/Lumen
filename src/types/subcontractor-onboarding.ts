// UMTELKOMD Subunternehmer-Onboarding & Compliance record.
// §1 company data · §3 A1 worker roster · §4 verification / confirmation.
// Per-document checklist (§2) is tracked via contractor_documents.

export interface A1Worker {
  name: string
  a1_valid_until: string | null // YYYY-MM-DD
  id_number: string
}

export interface SubcontractorOnboarding {
  id: string
  contractor_id: string

  // §1 Angaben zum Subunternehmer
  company_name: string | null
  ust_id_es: string | null
  address: string | null
  tax_number_de: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  project_site: string | null
  deployment_period: string | null

  // §3 Eingesetzte Mitarbeiter (A1)
  a1_workers: A1Worker[]

  // §4 Prüfung & Bestätigung
  checked_48b: boolean
  withhold_bauabzug: boolean
  ust_id_confirmed: boolean
  place_date: string | null
  verified_by: string | null
  notes: string | null

  created_by: string | null
  created_at: string
  updated_at: string
}

// Fields that are user-editable in the form / persisted on save.
export type SubcontractorOnboardingPayload = Omit<
  SubcontractorOnboarding,
  'id' | 'created_by' | 'created_at' | 'updated_at'
>

export function emptyOnboarding(contractorId: string): SubcontractorOnboardingPayload {
  return {
    contractor_id: contractorId,
    company_name: '',
    ust_id_es: '',
    address: '',
    tax_number_de: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    project_site: '',
    deployment_period: '',
    a1_workers: [],
    checked_48b: false,
    withhold_bauabzug: false,
    ust_id_confirmed: false,
    place_date: '',
    verified_by: '',
    notes: '',
  }
}

export function emptyA1Worker(): A1Worker {
  return { name: '', a1_valid_until: null, id_number: '' }
}
