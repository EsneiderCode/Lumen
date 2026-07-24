// send-email — transactional compliance email, client-triggered (Fase 4).
//
// Used by the review inbox to tell an entity owner their document was approved
// or rejected, in real time. NOT an open relay: the caller must hold
// compliance.review and the HTML is built server-side from a typed event, so
// callers cannot inject arbitrary content. Delivery is via Resend
// (_shared/email.ts). Best-effort: a failed send returns 200 { sent: false }.

import { CORS_HEADERS, env, json, supabaseFetch, userIdFromJwt } from '../_shared/http.ts'
import { esc, sendEmail } from '../_shared/email.ts'

type Locale = 'es' | 'de'

interface ReviewResultBody {
  type: 'doc_review_result'
  to: string
  entityName: string
  docName: string
  action: 'approved' | 'rejected'
  rejectionText?: string
  locale?: Locale
}

async function hasPermission(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  permission: string,
): Promise<boolean> {
  try {
    const allowed = await supabaseFetch<boolean>(
      supabaseUrl,
      serviceRoleKey,
      'rpc/user_has_permission',
      { method: 'POST', body: JSON.stringify({ uid: userId, perm: permission }) },
    )
    return allowed === true
  } catch {
    return false
  }
}

const COPY: Record<Locale, {
  approvedSubject: (doc: string) => string
  rejectedSubject: (doc: string) => string
  approvedBody: (entity: string, doc: string) => string
  rejectedBody: (entity: string, doc: string) => string
  reasonLabel: string
  footer: string
}> = {
  es: {
    approvedSubject: (doc) => `Documento aprobado: ${doc}`,
    rejectedSubject: (doc) => `Documento rechazado: ${doc}`,
    approvedBody: (entity, doc) =>
      `El documento <b>${esc(doc)}</b> de <b>${esc(entity)}</b> ha sido aprobado.`,
    rejectedBody: (entity, doc) =>
      `El documento <b>${esc(doc)}</b> de <b>${esc(entity)}</b> ha sido rechazado. Por favor, súbelo de nuevo corrigiendo lo indicado.`,
    reasonLabel: 'Motivo',
    footer: 'LUMEN · HMR Nexus Engineering GmbH',
  },
  de: {
    approvedSubject: (doc) => `Dokument genehmigt: ${doc}`,
    rejectedSubject: (doc) => `Dokument abgelehnt: ${doc}`,
    approvedBody: (entity, doc) =>
      `Das Dokument <b>${esc(doc)}</b> von <b>${esc(entity)}</b> wurde genehmigt.`,
    rejectedBody: (entity, doc) =>
      `Das Dokument <b>${esc(doc)}</b> von <b>${esc(entity)}</b> wurde abgelehnt. Bitte laden Sie es korrigiert erneut hoch.`,
    reasonLabel: 'Grund',
    footer: 'LUMEN · HMR Nexus Engineering GmbH',
  },
}

function buildReviewEmail(body: ReviewResultBody): { subject: string; html: string } {
  const locale: Locale = body.locale === 'de' ? 'de' : 'es'
  const c = COPY[locale]
  const approved = body.action === 'approved'
  const subject = approved ? c.approvedSubject(body.docName) : c.rejectedSubject(body.docName)
  const intro = approved
    ? c.approvedBody(body.entityName, body.docName)
    : c.rejectedBody(body.entityName, body.docName)
  const reason =
    !approved && body.rejectionText
      ? `<p style="margin:12px 0;padding:10px 12px;border-left:3px solid #FF4D2E;background:#161920;color:#F5F3EE">` +
        `<b>${c.reasonLabel}:</b> ${esc(body.rejectionText)}</p>`
      : ''
  const html =
    `<div style="font-family:Inter,Arial,sans-serif;color:#F5F3EE;background:#0E1014;padding:24px;border-radius:10px">` +
    `<p style="margin:0 0 12px">${intro}</p>` +
    reason +
    `<p style="margin:16px 0 0;color:#7B7D7A;font-size:12px">${c.footer}</p>` +
    `</div>`
  return { subject, html }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const supabaseUrl = env('SUPABASE_URL')
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')

    const auth = req.headers.get('authorization')
    if (!auth) return json(401, { error: 'Missing authorization' })
    const userId = userIdFromJwt(auth)
    if (!userId) return json(401, { error: 'Invalid authorization' })

    if (!(await hasPermission(supabaseUrl, serviceRoleKey, userId, 'compliance.review'))) {
      return json(403, { error: 'compliance.review required' })
    }

    const body = (await req.json().catch(() => null)) as ReviewResultBody | null
    if (!body || body.type !== 'doc_review_result') {
      return json(400, { error: 'Unsupported email type' })
    }
    if (!body.to || !body.entityName || !body.docName || !body.action) {
      return json(400, { error: 'Missing fields' })
    }

    const { subject, html } = buildReviewEmail(body)
    const sent = await sendEmail({ to: body.to, subject, html })
    return json(200, { ok: true, sent })
  } catch (error) {
    console.error('[send-email] failed', error)
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
})
