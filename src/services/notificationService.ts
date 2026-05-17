/**
 * Notification service — Telegram integration via Supabase Edge Function.
 * Bot credentials stay server-side in TELEGRAM_BOT_TOKEN.
 * Target groups are resolved from the `telegram_groups` / `event_group_mappings`
 * tables configured in the admin dashboard.
 * All functions are fire-and-forget: failures are logged but never thrown.
 */

import { supabase } from '@/lib/supabase'

async function sendTelegram(payload: Record<string, string>): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-telegram', {
      body: payload,
    })
    if (error) console.warn('[notification] send-telegram failed', error.message)
  } catch {
    // Non-critical — never break the main flow
  }
}

/**
 * Notifies configured groups that an order has been returned for correction.
 * Triggered after a successful `returned` status transition.
 */
export async function notifyOrderReturnedForCorrection(
  orderNumber: string,
  reason: string,
  adminName?: string,
): Promise<void> {
  await sendTelegram({
    type: 'order_returned_for_correction',
    orderNumber,
    reason,
    ...(adminName ? { adminName } : {}),
  })
}

/**
 * Notifies configured groups that a work order has been assigned to someone.
 * Triggered after a successful assignment action.
 */
export async function notifyTaskAssigned(
  orderNumber: string,
  assignedTo: string,
  adminName?: string,
): Promise<void> {
  await sendTelegram({
    type: 'task_assigned',
    orderNumber,
    assignedTo,
    ...(adminName ? { adminName } : {}),
  })
}

/**
 * Notifies configured groups of a status change, reassignment, or modification
 * on a work order (covers: reasignación, cambio de estado, edición, eliminación).
 */
export async function notifyOrderStatusChanged(
  orderNumber: string,
  newStatus: string,
  adminName?: string,
  reason?: string,
): Promise<void> {
  await sendTelegram({
    type: 'order_status_changed',
    orderNumber,
    newStatus,
    ...(adminName ? { adminName } : {}),
    ...(reason ? { reason } : {}),
  })
}
