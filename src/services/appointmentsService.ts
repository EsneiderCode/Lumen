import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

export type AppointmentStatus =
  | 'proposed'
  | 'confirmed'
  | 'rescheduled'
  | 'completed'
  | 'cancelled'

export type AppointmentLine = 'NE3' | 'NE4'

export interface Appointment {
  id: string
  work_order_id: string | null
  line: AppointmentLine
  operator_id: string
  scheduled_at: string
  duration_min: number
  address: string | null
  contact_name: string | null
  contact_phone: string | null
  status: AppointmentStatus
  notes: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  operators?: { id: string; code: string; name: string } | null
}

export interface CreateAppointmentInput {
  line: AppointmentLine
  operator_id: string
  scheduled_at: string
  duration_min?: number
  address?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  notes?: string | null
  work_order_id?: string | null
}

type AppointmentRow = Database['public']['Tables']['appointments']['Row']
type AppointmentInsert = Database['public']['Tables']['appointments']['Insert']
type AppointmentUpdate = Database['public']['Tables']['appointments']['Update']

const SELECT_WITH_OPERATOR = '*, operators(id, code, name)'

/**
 * Allowed status transitions for the scheduler workflow.
 * proposed → confirmed | rescheduled | cancelled
 * confirmed → completed | rescheduled | cancelled
 * rescheduled → confirmed | completed | cancelled
 * completed / cancelled are terminal.
 */
const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  proposed: ['confirmed', 'rescheduled', 'cancelled'],
  confirmed: ['completed', 'rescheduled', 'cancelled'],
  rescheduled: ['confirmed', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

/** List every appointment, newest first. Schedulers share all appointments;
 *  RLS (migration 037) already restricts this to the scheduler/admin roles. */
export async function listAppointments(): Promise<{ data: Appointment[]; error: string | null }> {
  const { data, error } = await supabase
    .from('appointments')
    .select(SELECT_WITH_OPERATOR)
    .order('scheduled_at', { ascending: false })

  return { data: (data as Appointment[] | null) ?? [], error: error?.message ?? null }
}

export async function getAppointment(
  id: string,
): Promise<{ data: Appointment | null; error: string | null }> {
  const { data, error } = await supabase
    .from('appointments')
    .select(SELECT_WITH_OPERATOR)
    .eq('id', id)
    .single()

  return { data: (data as Appointment | null) ?? null, error: error?.message ?? null }
}

export async function createAppointment(
  input: CreateAppointmentInput,
  userId: string,
): Promise<{ data: Appointment | null; error: string | null }> {
  if (!input.scheduled_at) {
    return { data: null, error: 'Termin (Datum/Uhrzeit) ist erforderlich.' }
  }
  if (!input.line || !input.operator_id) {
    return { data: null, error: 'Linie und Betreiber sind erforderlich.' }
  }

  const payload: AppointmentInsert = {
    line: input.line,
    operator_id: input.operator_id,
    scheduled_at: input.scheduled_at,
    duration_min: input.duration_min ?? 60,
    address: input.address?.trim() || null,
    contact_name: input.contact_name?.trim() || null,
    contact_phone: input.contact_phone?.trim() || null,
    notes: input.notes?.trim() || null,
    work_order_id: input.work_order_id || null,
    status: 'proposed',
    assigned_to: userId,
    created_by: userId,
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert(payload as never)
    .select(SELECT_WITH_OPERATOR)
    .single()

  return { data: (data as Appointment | null) ?? null, error: error?.message ?? null }
}

async function updateStatus(
  current: Appointment,
  next: AppointmentStatus,
  patch: AppointmentUpdate = {},
): Promise<{ data: Appointment | null; error: string | null }> {
  if (!canTransition(current.status, next)) {
    return { data: null, error: `Ungültiger Statuswechsel: ${current.status} → ${next}.` }
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({ ...patch, status: next } as never)
    .eq('id', current.id)
    .select(SELECT_WITH_OPERATOR)
    .single()

  return { data: (data as Appointment | null) ?? null, error: error?.message ?? null }
}

export function confirmAppointment(current: Appointment) {
  return updateStatus(current, 'confirmed')
}

export function completeAppointment(current: Appointment) {
  return updateStatus(current, 'completed')
}

export function cancelAppointment(current: Appointment, reason?: string) {
  return updateStatus(current, 'cancelled', reason ? { notes: reason } : {})
}

export function rescheduleAppointment(current: Appointment, scheduledAt: string) {
  return updateStatus(current, 'rescheduled', { scheduled_at: scheduledAt })
}

export type { AppointmentRow }
