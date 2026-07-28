/**
 * Ajustes del módulo de cumplimiento (migración 062).
 *
 * Hoy solo guardan el **encargado de la documentación**: el administrador que
 * recibe el correo cuando una empresa o un autónomo envía documentación a
 * revisión. Revisar la documentación puede seguir haciéndolo cualquier
 * administrador con `compliance.review` — el encargado es únicamente el
 * destinatario del aviso por correo, que manda la Edge Function
 * `compliance-upload`. La campana in-app la escribe el trigger de la 062 para
 * todos los revisores.
 *
 * La tabla es de fila única (PK booleana `true`), así que aquí solo hay lectura
 * y UPDATE: nunca INSERT ni DELETE.
 */

import { supabase } from '@/lib/supabase'

const SETTINGS_ID = true

export interface ReviewAssigneeCandidate {
  id: string
  fullName: string
  email: string | null
}

function msg(error: unknown): string | null {
  if (!error) return null
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

/** Perfil del encargado actual, o null si todavía no se ha elegido ninguno. */
export async function fetchReviewAssigneeId(): Promise<{
  data: string | null
  error: string | null
}> {
  const { data, error } = await supabase
    .from('compliance_settings')
    .select('review_assignee_id')
    .limit(1)
    .maybeSingle()
  return { data: data?.review_assignee_id ?? null, error: msg(error) }
}

/**
 * Candidatos: administradores activos. El rol `admin` trae por defecto los
 * permisos de cumplimiento (migración 042), y es el conjunto entre el que
 * Administración elige al encargado.
 */
export async function fetchReviewAssigneeCandidates(): Promise<{
  data: ReviewAssigneeCandidate[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'admin')
    .eq('is_active', true)
    .order('full_name')
  const rows = (data ?? []) as { id: string; full_name: string; email: string | null }[]
  return {
    data: rows.map((row) => ({ id: row.id, fullName: row.full_name, email: row.email })),
    error: msg(error),
  }
}

/** Asigna (o desasigna, con null) el encargado. Requiere compliance.configure_matrix. */
export async function setReviewAssignee(
  profileId: string | null,
  updatedBy: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('compliance_settings')
    .update({
      review_assignee_id: profileId,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    })
    .eq('id', SETTINGS_ID)
  return { error: msg(error) }
}
