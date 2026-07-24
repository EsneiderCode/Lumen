/**
 * In-app notification inbox (Fase 4). Rows in `notifications` are written only
 * by SECURITY DEFINER SQL (the compliance sweep + the review trigger); the app
 * only reads them and flips read_at. RLS restricts every query to the caller's
 * own rows, but we pass recipientId explicitly so demo mode (no RLS) matches.
 */

import { supabase } from '@/lib/supabase'

export type NotificationCategory =
  | 'doc_expiring'
  | 'doc_expired'
  | 'doc_approved'
  | 'doc_rejected'

export type NotificationLevel = 'info' | 'warn' | 'err'

export interface AppNotification {
  id: string
  recipient_id: string
  category: NotificationCategory
  level: NotificationLevel
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

function msg(error: unknown): string | null {
  if (!error) return null
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

export async function fetchUnreadCount(recipientId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', recipientId)
    .is('read_at', null)
  if (error) {
    console.warn('[notifications] unread count failed', msg(error))
    return 0
  }
  return count ?? 0
}

export async function fetchNotifications(
  recipientId: string,
  limit = 20,
): Promise<{ data: AppNotification[]; error: string | null }> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data: (data ?? []) as unknown as AppNotification[], error: msg(error) }
}

export async function markRead(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)
  return { error: msg(error) }
}

export async function markAllRead(recipientId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', recipientId)
    .is('read_at', null)
  return { error: msg(error) }
}
