import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Employee {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  sv_nummer: string | null
  steuer_id: string | null
  steuerklasse: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | null
  iban: string | null
  gross_salary: number
  start_date: string
  end_date: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EmployeePayload {
  full_name: string
  email?: string | null
  phone?: string | null
  sv_nummer?: string | null
  steuer_id?: string | null
  steuerklasse?: Employee['steuerklasse']
  iban?: string | null
  gross_salary: number
  start_date: string
  end_date?: string | null
  notes?: string | null
  is_active?: boolean
}

export interface VacationRequest {
  id: string
  employee_id: string
  year: number
  start_date: string
  end_date: string
  days_count: number
  status: 'pending' | 'approved' | 'rejected'
  notes: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export interface VacationPayload {
  employee_id: string
  year: number
  start_date: string
  end_date: string
  days_count: number
  notes?: string | null
}

type ServiceResult<T> = Promise<{ data: T; error: string | null }>

// ── Employee CRUD ─────────────────────────────────────────────────────────────

export async function fetchEmployees(
  includeInactive = false,
): ServiceResult<Employee[]> {
  let query = supabase
    .from('employees')
    .select('*')
    .order('full_name', { ascending: true })

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  return { data: (data as Employee[]) ?? [], error: error?.message ?? null }
}

export async function fetchEmployee(id: string): ServiceResult<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  return { data: data as Employee | null, error: error?.message ?? null }
}

export async function createEmployee(payload: EmployeePayload): ServiceResult<Employee> {
  const { data, error } = await supabase
    .from('employees')
    .insert(payload)
    .select()
    .single()

  return { data: data as Employee, error: error?.message ?? null }
}

export async function updateEmployee(
  id: string,
  payload: Partial<EmployeePayload>,
): ServiceResult<Employee> {
  const { data, error } = await supabase
    .from('employees')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  return { data: data as Employee, error: error?.message ?? null }
}

export async function deactivateEmployee(id: string): ServiceResult<null> {
  const { error } = await supabase
    .from('employees')
    .update({ is_active: false, end_date: new Date().toISOString().slice(0, 10) })
    .eq('id', id)

  return { data: null, error: error?.message ?? null }
}

// ── Vacation requests ─────────────────────────────────────────────────────────

export async function fetchVacationRequests(
  employeeId: string,
  year?: number,
): ServiceResult<VacationRequest[]> {
  let query = supabase
    .from('vacation_requests')
    .select('*')
    .eq('employee_id', employeeId)
    .order('start_date', { ascending: false })

  if (year !== undefined) {
    query = query.eq('year', year)
  }

  const { data, error } = await query
  return { data: (data as VacationRequest[]) ?? [], error: error?.message ?? null }
}

export async function createVacationRequest(
  payload: VacationPayload,
): ServiceResult<VacationRequest> {
  const { data, error } = await supabase
    .from('vacation_requests')
    .insert(payload)
    .select()
    .single()

  return { data: data as VacationRequest, error: error?.message ?? null }
}

export async function updateVacationStatus(
  id: string,
  status: 'approved' | 'rejected',
  approvedBy: string,
): ServiceResult<VacationRequest> {
  const { data, error } = await supabase
    .from('vacation_requests')
    .update({
      status,
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  return { data: data as VacationRequest, error: error?.message ?? null }
}

export async function deleteVacationRequest(id: string): ServiceResult<null> {
  const { error } = await supabase.from('vacation_requests').delete().eq('id', id)
  return { data: null, error: error?.message ?? null }
}
