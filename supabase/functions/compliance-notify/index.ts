// compliance-notify — daily compliance digest fan-out (Fase 4).
//
// Invoked once a day by pg_cron via pg_net (see migration 048). NOT user-facing:
// with verify_jwt enabled the gateway verifies the caller's JWT signature, and
// the handler additionally requires the service_role claim — so only the
// scheduled job (or an operator holding the service key) can trigger the
// fan-out. Flow:
//   1) rpc/run_compliance_expiry_sweep → transitions documents to expiring/expired
//      AND writes the in-app notifications (that happens inside the SQL function).
//   2) Emails each affected entity's contact_email its own expiring/expired docs.
//   3) Emails an admin digest to every active admin with an email.
//   4) Posts a Telegram digest to COMPLIANCE_TELEGRAM_CHAT_ID (optional).
// Email/Telegram are best-effort; the in-app rows are already committed by step 1.

import { CORS_HEADERS, env, json, supabaseFetch } from '../_shared/http.ts'
import { esc, sendEmail } from '../_shared/email.ts'

/** Reads the `role` claim from a JWT payload (signature already checked by the gateway). */
function roleFromJwt(auth: string): string | null {
  try {
    const token = auth.replace(/^Bearer\s+/i, '')
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

interface Transition {
  entity_document_id: string
  entity_id: string
  entity_display_name: string
  entity_contact_email: string | null
  entity_profile_id: string | null
  document_type_code: string
  document_type_name: Record<string, string> | null
  new_status: 'expiring' | 'expired'
  expires_on: string | null
  days_remaining: number | null
}

interface AdminRow {
  email: string | null
}

function docName(t: Transition): string {
  return t.document_type_name?.es ?? t.document_type_name?.de ?? t.document_type_code
}

function statusLine(t: Transition): string {
  const name = esc(docName(t))
  if (t.new_status === 'expired') {
    return `❌ <b>${name}</b> — caducado (${t.expires_on ?? '—'})`
  }
  const days = t.days_remaining ?? 0
  return `⚠️ <b>${name}</b> — caduca en ${days} día(s) (${t.expires_on ?? '—'})`
}

function entityDigestHtml(entityName: string, items: Transition[]): string {
  const rows = items
    .map((t) => {
      const name = esc(docName(t))
      const detail =
        t.new_status === 'expired'
          ? `caducado el ${t.expires_on ?? '—'}`
          : `caduca en ${t.days_remaining ?? 0} día(s) (${t.expires_on ?? '—'})`
      return `<li style="margin:4px 0"><b>${name}</b> — ${detail}</li>`
    })
    .join('')
  return (
    `<div style="font-family:Inter,Arial,sans-serif;color:#F5F3EE;background:#0E1014;padding:24px;border-radius:10px">` +
    `<p style="margin:0 0 12px">Documentación de <b>${esc(entityName)}</b> que requiere atención:</p>` +
    `<ul style="margin:0 0 12px;padding-left:18px">${rows}</ul>` +
    `<p style="margin:16px 0 0;color:#7B7D7A;font-size:12px">LUMEN · HMR Nexus Engineering GmbH</p>` +
    `</div>`
  )
}

function adminDigestHtml(items: Transition[]): string {
  const rows = items
    .map((t) => {
      const detail =
        t.new_status === 'expired'
          ? `caducado el ${t.expires_on ?? '—'}`
          : `caduca en ${t.days_remaining ?? 0} día(s)`
      return `<li style="margin:4px 0"><b>${esc(t.entity_display_name)}</b> — ${esc(docName(t))} (${detail})</li>`
    })
    .join('')
  return (
    `<div style="font-family:Inter,Arial,sans-serif;color:#F5F3EE;background:#0E1014;padding:24px;border-radius:10px">` +
    `<p style="margin:0 0 12px">Resumen de compliance — ${items.length} documento(s) requieren atención:</p>` +
    `<ul style="margin:0 0 12px;padding-left:18px">${rows}</ul>` +
    `<p style="margin:16px 0 0;color:#7B7D7A;font-size:12px">LUMEN · HMR Nexus Engineering GmbH</p>` +
    `</div>`
  )
}

async function sendTelegramDigest(items: Transition[]): Promise<boolean> {
  const chatId = Deno.env.get('COMPLIANCE_TELEGRAM_CHAT_ID')
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!chatId || !botToken) return false

  const lines = items.slice(0, 30).map(statusLine)
  const text =
    `🗂️ <b>Resumen de compliance</b>\n\n` +
    `${items.length} documento(s) requieren atención:\n\n` +
    lines.join('\n')

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    if (!res.ok) {
      console.error('[compliance-notify] telegram failed', await res.text())
      return false
    }
    return true
  } catch (error) {
    console.error('[compliance-notify] telegram threw', error)
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const supabaseUrl = env('SUPABASE_URL')
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')

    // Auth guard: verify_jwt (config.toml) makes the gateway verify the token's
    // signature against the project; we additionally require the service_role
    // claim. Checking the CLAIM — not an exact match against the injected key —
    // keeps this working across key rotations (toggling legacy keys, etc.).
    const auth = req.headers.get('authorization') ?? ''
    if (roleFromJwt(auth) !== 'service_role') {
      return json(401, { error: 'Service role required' })
    }

    // 1) Run the sweep — transitions + in-app notifications happen in SQL.
    const transitions = await supabaseFetch<Transition[]>(
      supabaseUrl,
      serviceRoleKey,
      'rpc/run_compliance_expiry_sweep',
      { method: 'POST', body: '{}' },
    )

    if (!transitions.length) {
      return json(200, { ok: true, transitions: 0, entityEmails: 0, adminEmails: 0, telegram: false })
    }

    // 2) Per-entity emails to contact_email.
    const byEntity = new Map<string, Transition[]>()
    for (const t of transitions) {
      const list = byEntity.get(t.entity_id) ?? []
      list.push(t)
      byEntity.set(t.entity_id, list)
    }
    let entityEmails = 0
    for (const items of byEntity.values()) {
      const email = items[0].entity_contact_email
      if (!email) continue
      const ok = await sendEmail({
        to: email,
        subject: `Documentación de compliance — acción requerida (${items.length})`,
        html: entityDigestHtml(items[0].entity_display_name, items),
      })
      if (ok) entityEmails += 1
    }

    // 3) Admin digest — active admins with an email. Admins hold the compliance
    //    permissions by default (migration 042), so role=admin is the recipient set.
    const admins = await supabaseFetch<AdminRow[]>(
      supabaseUrl,
      serviceRoleKey,
      'profiles?select=email&role=eq.admin&is_active=eq.true',
      { method: 'GET' },
    )
    const adminEmailList = admins.map((a) => a.email).filter((e): e is string => !!e)
    let adminEmails = 0
    if (adminEmailList.length) {
      const ok = await sendEmail({
        to: adminEmailList,
        subject: `Resumen de compliance — ${transitions.length} documento(s)`,
        html: adminDigestHtml(transitions),
      })
      if (ok) adminEmails = adminEmailList.length
    }

    // 4) Telegram digest (optional).
    const telegram = await sendTelegramDigest(transitions)

    return json(200, {
      ok: true,
      transitions: transitions.length,
      entityEmails,
      adminEmails,
      telegram,
    })
  } catch (error) {
    console.error('[compliance-notify] failed', error)
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
})
