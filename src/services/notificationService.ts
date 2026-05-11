/**
 * Notification service — Telegram webhook integration.
 * Reads VITE_TELEGRAM_BOT_TOKEN and VITE_TELEGRAM_CHAT_ID from env.
 * All functions are fire-and-forget: failures are logged but never thrown.
 */

const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string | undefined
const CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID as string | undefined

async function sendTelegram(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
    })
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
  const who = adminName ? ` por <b>${adminName}</b>` : ''
  const text =
    `⚠️ <b>Orden devuelta para corrección</b>\n\n` +
    `🔖 OS: <b>${orderNumber}</b>\n` +
    `👤 Devuelta${who}\n\n` +
    `📋 <b>Motivo:</b>\n${reason}`
  await sendTelegram(text)
}
