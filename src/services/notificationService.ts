/**
 * Notification service — Telegram integration via Supabase Edge Function.
 * Bot credentials stay server-side in TELEGRAM_BOT_TOKEN.
 * Target groups are resolved per event: if the event concerns a user
 * (`affectedUserId`) with groups assigned in `user_telegram_groups`, only
 * those groups are notified; otherwise the `telegram_groups` /
 * `event_group_mappings` configuration from the admin dashboard applies.
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
  affectedUserId?: string,
): Promise<void> {
  await sendTelegram({
    type: 'order_returned_for_correction',
    orderNumber,
    reason,
    ...(adminName ? { adminName } : {}),
    ...(affectedUserId ? { affectedUserId } : {}),
  })
}

/**
 * Notifies configured groups that a work order has been assigned to someone.
 * Triggered after a successful assignment action.
 */
export async function notifyTaskAssigned(opts: {
  orderNumber: string
  teamName: string
  technicianName?: string
  previousTeam?: string
  previousTechnician?: string
  workType?: string
  assignedDate?: string
  address?: string
  orderUrl: string
  adminName?: string
  reassignmentNote?: string
  affectedUserId?: string
}): Promise<void> {
  await sendTelegram({
    type: 'task_assigned',
    orderNumber: opts.orderNumber,
    assignedTo: opts.teamName,
    technicianName: opts.technicianName ?? '',
    previousTeam: opts.previousTeam ?? '',
    previousTechnician: opts.previousTechnician ?? '',
    workType: opts.workType ?? '',
    assignedDate: opts.assignedDate ?? '',
    address: opts.address ?? '',
    orderUrl: opts.orderUrl,
    ...(opts.adminName ? { adminName: opts.adminName } : {}),
    ...(opts.reassignmentNote ? { reason: opts.reassignmentNote } : {}),
    ...(opts.affectedUserId ? { affectedUserId: opts.affectedUserId } : {}),
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
  affectedUserId?: string,
): Promise<void> {
  await sendTelegram({
    type: 'order_status_changed',
    orderNumber,
    newStatus,
    ...(adminName ? { adminName } : {}),
    ...(reason ? { reason } : {}),
    ...(affectedUserId ? { affectedUserId } : {}),
  })
}

/**
 * Notifies configured groups that a work order has been cancelled.
 * Triggered after a successful transition to `cancelled`.
 */
export async function notifyOrderCancelled(
  orderNumber: string,
  reason?: string,
  adminName?: string,
  affectedUserId?: string,
): Promise<void> {
  await sendTelegram({
    type: 'order_cancelled',
    orderNumber,
    ...(reason ? { reason } : {}),
    ...(adminName ? { adminName } : {}),
    ...(affectedUserId ? { affectedUserId } : {}),
  })
}

/**
 * Notifies configured groups that a technician has submitted a Rückmeldung.
 * Triggered after a successful report submission (rueckmeldung_sent).
 */
export async function notifyReportSubmitted(opts: {
  orderNumber: string
  techName?: string
  workType?: string
  address?: string
  city?: string
  summary?: string
  techNotes?: string
  orderUrl: string
}): Promise<void> {
  await sendTelegram({
    type: 'report_submitted',
    orderNumber: opts.orderNumber,
    techName: opts.techName ?? '',
    workType: opts.workType ?? '',
    address: opts.address ?? '',
    city: opts.city ?? '',
    summary: opts.summary ?? '',
    techNotes: opts.techNotes ?? '',
    orderUrl: opts.orderUrl,
  })
}

/**
 * Notifies configured groups that a work order has been deleted.
 * Triggered after a successful deletion.
 */
export async function notifyOrderDeleted(opts: {
  orderNumber: string
  teamName?: string
  technicianName?: string
  workType?: string
  address?: string
  adminName?: string
  affectedUserId?: string
}): Promise<void> {
  await sendTelegram({
    type: 'order_deleted',
    orderNumber: opts.orderNumber,
    assignedTo: opts.teamName ?? '',
    technicianName: opts.technicianName ?? '',
    workType: opts.workType ?? '',
    address: opts.address ?? '',
    ...(opts.adminName ? { adminName: opts.adminName } : {}),
    ...(opts.affectedUserId ? { affectedUserId: opts.affectedUserId } : {}),
  })
}
