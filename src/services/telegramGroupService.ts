import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TelegramGroupPurpose = 'tareas' | 'alertas' | 'notificaciones'

export type TelegramEventType =
  | 'order_returned_for_correction'
  | 'task_assigned'
  | 'order_status_changed'

export const TELEGRAM_EVENT_TYPES: TelegramEventType[] = [
  'order_returned_for_correction',
  'task_assigned',
  'order_status_changed',
]

export const TELEGRAM_GROUP_PURPOSES: TelegramGroupPurpose[] = [
  'tareas',
  'alertas',
  'notificaciones',
]

export interface TelegramGroup {
  id: string
  chat_id: string
  name: string
  purpose: TelegramGroupPurpose
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EventGroupMapping {
  id: string
  event_type: TelegramEventType
  telegram_group_id: string
  is_active: boolean
  created_at: string
}

export interface GroupPayload {
  chat_id: string
  name: string
  purpose: TelegramGroupPurpose
  is_active: boolean
}

// ── Group CRUD ────────────────────────────────────────────────────────────────

export async function fetchGroups(): Promise<TelegramGroup[]> {
  const { data, error } = await supabase
    .from('telegram_groups')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createGroup(payload: GroupPayload): Promise<TelegramGroup> {
  const { data, error } = await supabase
    .from('telegram_groups')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateGroup(id: string, payload: Partial<GroupPayload>): Promise<TelegramGroup> {
  const { data, error } = await supabase
    .from('telegram_groups')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteGroup(id: string): Promise<void> {
  const { error } = await supabase.from('telegram_groups').delete().eq('id', id)
  if (error) throw error
}

// ── Event → Group mappings ────────────────────────────────────────────────────

export async function fetchMappings(): Promise<EventGroupMapping[]> {
  const { data, error } = await supabase.from('event_group_mappings').select('*')
  if (error) throw error
  return data ?? []
}

/**
 * Toggle a single event → group mapping.
 * active=true  → upsert (insert or set is_active=true)
 * active=false → delete the row entirely
 */
export async function setMapping(
  eventType: TelegramEventType,
  groupId: string,
  active: boolean,
): Promise<void> {
  if (active) {
    const { error } = await supabase.from('event_group_mappings').upsert(
      { event_type: eventType, telegram_group_id: groupId, is_active: true },
      { onConflict: 'event_type,telegram_group_id' },
    )
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('event_group_mappings')
      .delete()
      .eq('event_type', eventType)
      .eq('telegram_group_id', groupId)
    if (error) throw error
  }
}

// ── Chat ID validation ────────────────────────────────────────────────────────

export interface ValidateChatResult {
  ok: boolean
  title?: string
}

export async function validateChatId(chatId: string): Promise<ValidateChatResult> {
  const { data, error } = await supabase.functions.invoke('send-telegram', {
    body: { action: 'validate_chat', chatId },
  })
  if (error) return { ok: false }
  return (data as ValidateChatResult) ?? { ok: false }
}
