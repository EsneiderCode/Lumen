/**
 * Notification service — Telegram integration via Supabase Edge Function.
 * Bot credentials stay server-side in TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID.
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
 * Notifies the technician channel that an OS has been returned for correction.
 * Called after a successful `returned` status transition.
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
