/**
 * dispatch-finance-outbox
 *
 * Pushes pending finance_outbox rows into FinControl Firestore
 * (artifacts/{appId}/public/data/payables|receivables) using a Google
 * service account (Firestore REST API).
 *
 * Secrets (Supabase Edge Function):
 *   FIREBASE_PROJECT_ID          e.g. umtelkomd-finance
 *   FIREBASE_APP_ID              e.g. 1:597712756560:web:ad12cd9794f11992641655
 *   FIREBASE_SERVICE_ACCOUNT_JSON  full service account JSON string
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (auto)
 *
 * Auth: admin JWT (Authorization Bearer) OR header x-dispatch-secret
 * matching DISPATCH_SECRET (optional cron).
 *
 * Idempotent: documents keyed by sourceKey via query + patch/create.
 */
import { CORS_HEADERS, env, json, supabaseFetch, userIdFromJwt } from '../_shared/http.ts'

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void
  env: { get(name: string): string | undefined }
}

// ── Google service account access token ──────────────────────────────────────

async function getGoogleAccessToken(sa: {
  client_email: string
  private_key: string
  token_uri?: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const enc = (obj: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

  const unsigned = `${enc(header)}.${enc(claim)}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const jwt = `${unsigned}.${signature}`
  const tokenRes = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!tokenRes.ok) {
    throw new Error(`Google token failed: ${await tokenRes.text()}`)
  }
  const tokenBody = (await tokenRes.json()) as { access_token?: string }
  if (!tokenBody.access_token) throw new Error('No access_token from Google')
  return tokenBody.access_token
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const raw = atob(b64)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return buf.buffer
}

// ── Firestore helpers ────────────────────────────────────────────────────────

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FsValue[] } }

function fsString(v: string): FsValue {
  return { stringValue: v }
}
function fsDouble(v: number): FsValue {
  return { doubleValue: v }
}
function fsBool(v: boolean): FsValue {
  return { booleanValue: v }
}
function fsNull(): FsValue {
  return { nullValue: null }
}

function collectionParent(projectId: string, appId: string, collection: string): string {
  // Nested path under artifacts/{appId}/public/data/{collection}
  const encApp = encodeURIComponent(appId)
  return `projects/${projectId}/databases/(default)/documents/artifacts/${encApp}/public/data/${collection}`
}

async function findBySourceKey(
  accessToken: string,
  projectId: string,
  appId: string,
  collection: 'payables' | 'receivables',
  sourceKey: string,
): Promise<{ name: string; fields: Record<string, FsValue> } | null> {
  // Nested path: artifacts/{appId}/public/data/{collection}
  const parent = `projects/${projectId}/databases/(default)/documents/artifacts/${encodeURIComponent(appId)}/public/data`
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'sourceKey' },
          op: 'EQUAL',
          value: { stringValue: sourceKey },
        },
      },
      limit: 1,
    },
  }
  const res = await fetch(`https://firestore.googleapis.com/v1/${parent}:runQuery`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Firestore query failed: ${await res.text()}`)
  const rows = (await res.json()) as Array<{ document?: { name: string; fields: Record<string, FsValue> } }>
  const doc = rows.find((r) => r.document)?.document
  return doc ?? null
}

async function createDoc(
  accessToken: string,
  parentPath: string,
  fields: Record<string, FsValue>,
): Promise<string> {
  const res = await fetch(`https://firestore.googleapis.com/v1/${parentPath}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`Firestore create failed: ${await res.text()}`)
  const body = (await res.json()) as { name?: string }
  return body.name || ''
}

async function patchDoc(
  accessToken: string,
  documentName: string,
  fields: Record<string, FsValue>,
  fieldPaths: string[],
): Promise<void> {
  const mask = fieldPaths.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&')
  const res = await fetch(`https://firestore.googleapis.com/v1/${documentName}?${mask}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`Firestore patch failed: ${await res.text()}`)
}

// ── Event → Firestore fields ─────────────────────────────────────────────────

function payableFields(payload: Record<string, unknown>, nowIso: string): Record<string, FsValue> {
  const amount = Number(payload.gross_amount) || 0
  return {
    accountId: fsString('main'),
    currency: fsString(String(payload.currency || 'EUR')),
    vendor: fsString(String(payload.vendor_name || '')),
    counterpartyName: fsString(String(payload.vendor_name || '')),
    description: fsString(String(payload.description || '')),
    documentNumber: fsString(String(payload.document_number || payload.cycle_id || '')),
    projectCode: fsString(String(payload.project_code || '')),
    projectName: fsString(String(payload.project_code || '')),
    projectId: fsString(''),
    grossAmount: fsDouble(amount),
    amount: fsDouble(amount),
    openAmount: fsDouble(amount),
    pendingAmount: fsDouble(amount),
    paidAmount: fsDouble(0),
    status: fsString('issued'),
    issueDate: fsString(nowIso.slice(0, 10)),
    dueDate: fsString(String(payload.payment_date || nowIso.slice(0, 10))),
    sourceKey: fsString(String(payload.source_key || '')),
    sourceSystem: fsString('lumen'),
    source: fsString('lumen'),
    lumenCycleId: fsString(String(payload.cycle_id || '')),
    productionWeekRef: fsString(String(payload.production_week_ref || payload.week || '')),
    opsGateRequired: fsBool(payload.ops_gate_required !== false),
    opsCleared: fsBool(payload.ops_cleared !== false),
    opsClearedAt: payload.ops_cleared !== false ? fsString(nowIso) : fsNull(),
    opsClearedBy: fsString('lumen-outbox'),
    notes: fsString('finance_outbox dispatch'),
    createdBy: fsString('lumen-outbox'),
    updatedBy: fsString('lumen-outbox'),
  }
}

function receivableFields(payload: Record<string, unknown>, nowIso: string): Record<string, FsValue> {
  const amount = Number(payload.gross_amount) || 0
  return {
    accountId: fsString('main'),
    currency: fsString(String(payload.currency || 'EUR')),
    client: fsString(String(payload.client_name || '')),
    counterpartyName: fsString(String(payload.client_name || '')),
    description: fsString(String(payload.description || '')),
    documentNumber: fsString(String(payload.document_number || payload.order_number || '')),
    projectCode: fsString(String(payload.project_code || '')),
    projectName: fsString(String(payload.project_code || '')),
    projectId: fsString(''),
    grossAmount: fsDouble(amount),
    amount: fsDouble(amount),
    openAmount: fsDouble(amount),
    pendingAmount: fsDouble(amount),
    paidAmount: fsDouble(0),
    status: fsString('issued'),
    issueDate: fsString(nowIso.slice(0, 10)),
    dueDate: fsString(String(payload.due_date || nowIso.slice(0, 10))),
    sourceKey: fsString(String(payload.source_key || '')),
    sourceSystem: fsString('lumen'),
    source: fsString('lumen'),
    lumenWorkOrderId: fsString(String(payload.work_order_id || '')),
    lumenOrderNumber: fsString(String(payload.order_number || '')),
    productionWeekRef: fsString(String(payload.week || '')),
    notes: fsString('finance_outbox dispatch'),
    createdBy: fsString('lumen-outbox'),
    updatedBy: fsString('lumen-outbox'),
  }
}

async function applyEvent(
  accessToken: string,
  projectId: string,
  appId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<'created' | 'updated'> {
  const sourceKey = String(payload.source_key || '')
  if (!sourceKey) throw new Error('payload.source_key missing')

  const collection = eventType === 'finance.cxp_from_cycle.v1' ? 'payables' : 'receivables'
  const nowIso = new Date().toISOString()
  const fields =
    collection === 'payables' ? payableFields(payload, nowIso) : receivableFields(payload, nowIso)

  const existing = await findBySourceKey(accessToken, projectId, appId, collection, sourceKey)
  if (existing?.name) {
    // Do not reopen settled — check status field if present
    const status = (existing.fields?.status as { stringValue?: string } | undefined)?.stringValue
    if (status === 'settled' || status === 'cancelled') {
      return 'updated'
    }
    const paths = Object.keys(fields)
    await patchDoc(accessToken, existing.name, fields, paths)
    return 'updated'
  }

  const parent = collectionParent(projectId, appId, collection)
  await createDoc(accessToken, parent, fields)
  return 'created'
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    const supabaseUrl = env('SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID') || ''
    const appId = Deno.env.get('FIREBASE_APP_ID') || ''
    const saJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || ''
    const dispatchSecret = Deno.env.get('DISPATCH_SECRET') || ''

    if (!projectId || !appId || !saJson) {
      return json(503, {
        error:
          'Missing FIREBASE_PROJECT_ID / FIREBASE_APP_ID / FIREBASE_SERVICE_ACCOUNT_JSON secrets on Edge Function',
      })
    }

    // Auth: cron secret or admin JWT
    const auth = req.headers.get('authorization') || ''
    const cronHeader = req.headers.get('x-dispatch-secret') || ''
    let authorized = false
    if (dispatchSecret && cronHeader && cronHeader === dispatchSecret) authorized = true
    if (!authorized && auth) {
      const uid = userIdFromJwt(auth)
      if (uid) {
        const profile = await supabaseFetch<{ role?: string; is_active?: boolean }[]>(
          supabaseUrl,
          serviceKey,
          `profiles?id=eq.${uid}&select=role,is_active`,
          { method: 'GET' },
        )
        if (profile[0]?.role === 'admin' && profile[0]?.is_active !== false) authorized = true
      }
    }
    if (!authorized) return json(401, { error: 'Unauthorized' })

    let limit = 25
    if (req.method === 'POST') {
      try {
        const body = (await req.json()) as { limit?: number }
        if (body.limit) limit = Math.min(100, Math.max(1, body.limit))
      } catch {
        /* empty body ok */
      }
    }

    const pending = await supabaseFetch<
      Array<{
        id: string
        event_type: string
        idempotency_key: string
        payload: Record<string, unknown>
        attempts: number
      }>
    >(
      supabaseUrl,
      serviceKey,
      `finance_outbox?status=eq.pending&order=created_at.asc&limit=${limit}`,
      { method: 'GET', headers: { Prefer: 'return=representation' } },
    )

    const sa = JSON.parse(saJson) as {
      client_email: string
      private_key: string
      token_uri?: string
    }
    const accessToken = await getGoogleAccessToken(sa)

    let sent = 0
    let failed = 0
    const results: Array<{ id: string; ok: boolean; action?: string; error?: string }> = []

    for (const row of pending) {
      // mark processing
      await supabaseFetch(supabaseUrl, serviceKey, `finance_outbox?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'processing',
          attempts: (row.attempts || 0) + 1,
          updated_at: new Date().toISOString(),
        }),
      })

      try {
        const action = await applyEvent(
          accessToken,
          projectId,
          appId,
          row.event_type,
          row.payload || {},
        )
        await supabaseFetch(supabaseUrl, serviceKey, `finance_outbox?id=eq.${row.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            status: 'sent',
            sent_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          }),
        })
        sent += 1
        results.push({ id: row.id, ok: true, action })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const attempts = (row.attempts || 0) + 1
        const status = attempts >= 8 ? 'dead' : 'failed'
        await supabaseFetch(supabaseUrl, serviceKey, `finance_outbox?id=eq.${row.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            status,
            last_error: msg.slice(0, 2000),
            updated_at: new Date().toISOString(),
          }),
        })
        // re-queue failed (not dead) as pending for next run
        if (status === 'failed') {
          await supabaseFetch(supabaseUrl, serviceKey, `finance_outbox?id=eq.${row.id}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ status: 'pending', updated_at: new Date().toISOString() }),
          })
        }
        failed += 1
        results.push({ id: row.id, ok: false, error: msg })
      }
    }

    return json(200, {
      processed: pending.length,
      sent,
      failed,
      results,
    })
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) })
  }
})
