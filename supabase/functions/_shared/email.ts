// Shared Resend email helper for compliance notifications (Fase 4).
//
// Credentials stay server-side: RESEND_API_KEY + COMPLIANCE_FROM_EMAIL are Edge
// Function secrets. All sends are best-effort — callers log failures but never
// let a bounced email break the main flow.

export interface EmailMessage {
  to: string | string[]
  subject: string
  html: string
}

/**
 * Sends one email via the Resend REST API. Returns true on 2xx. Never throws —
 * a missing key or Resend outage resolves to false so the caller can continue.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('COMPLIANCE_FROM_EMAIL')
  if (!apiKey || !from) {
    console.warn('[email] RESEND_API_KEY / COMPLIANCE_FROM_EMAIL not configured — skipping send')
    return false
  }

  const recipients = Array.isArray(message.to) ? message.to : [message.to]
  const to = recipients.map((r) => r.trim()).filter(Boolean)
  if (to.length === 0) return false

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject: message.subject, html: message.html }),
    })
    if (!res.ok) {
      console.error('[email] Resend send failed', res.status, await res.text())
      return false
    }
    return true
  } catch (error) {
    console.error('[email] Resend send threw', error)
    return false
  }
}

/** Minimal HTML escape for interpolated values. */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
