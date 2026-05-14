import { CORS_HEADERS, env, json, selectOne } from '../_shared/http.ts'

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

interface AuthUserResponse {
  id?: string
}

type ProfileRow = Record<string, unknown> & {
  role: 'admin' | 'technician' | 'contractor'
  is_active: boolean
}

interface TelegramBody {
  type?: string
  orderNumber?: string
  reason?: string
  adminName?: string
}

const FIELD_LIMITS = {
  orderNumber: 120,
  reason: 3_000,
  adminName: 120,
} as const

function readBody(value: unknown): TelegramBody {
  if (!value || typeof value !== 'object') return {}
  const body = value as Record<string, unknown>
  return {
    type: typeof body.type === 'string' ? body.type : undefined,
    orderNumber: typeof body.orderNumber === 'string' ? body.orderNumber : undefined,
    reason: typeof body.reason === 'string' ? body.reason : undefined,
    adminName: typeof body.adminName === 'string' ? body.adminName : undefined,
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function trimField(value: string | undefined, maxLength: number): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed
}

async function requireAdmin(
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<Response | null> {
  const auth = req.headers.get('authorization')
  if (!auth) return json(401, { error: 'Missing authorization' })

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: auth,
    },
  })
  if (!userRes.ok) return json(401, { error: 'Invalid authorization' })

  const authUser = (await userRes.json()) as AuthUserResponse
  if (!authUser.id) return json(401, { error: 'Invalid authorization' })

  const profile = await selectOne<ProfileRow>(
    supabaseUrl,
    serviceRoleKey,
    'profiles',
    `select=role,is_active&id=eq.${encodeURIComponent(authUser.id)}`,
  )
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return json(403, { error: 'Admin access required' })
  }
  return null
}

function buildMessage(body: TelegramBody): string | null {
  if (body.type !== 'order_returned_for_correction') return null
  const orderNumber = trimField(body.orderNumber, FIELD_LIMITS.orderNumber)
  const reason = trimField(body.reason, FIELD_LIMITS.reason)
  if (!orderNumber || !reason) return null

  const adminName = trimField(body.adminName, FIELD_LIMITS.adminName)
  const who = adminName ? ` por <b>${escapeHtml(adminName)}</b>` : ''
  return (
    `⚠️ <b>Orden devuelta para corrección</b>\n\n` +
    `🔖 OS: <b>${escapeHtml(orderNumber)}</b>\n` +
    `👤 Devuelta${who}\n\n` +
    `📋 <b>Motivo:</b>\n${escapeHtml(reason)}`
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const supabaseUrl = env('SUPABASE_URL')
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')
    const adminError = await requireAdmin(req, supabaseUrl, serviceRoleKey)
    if (adminError) return adminError

    const text = buildMessage(readBody(await req.json().catch(() => null)))
    if (!text) return json(400, { error: 'Invalid notification payload' })

    const botToken = env('TELEGRAM_BOT_TOKEN')
    const chatId = env('TELEGRAM_CHAT_ID')
    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })

    if (!telegramRes.ok) {
      const details = await telegramRes.text()
      console.error('[send-telegram] telegram failed', details)
      return json(502, { error: 'Telegram delivery failed' })
    }

    return json(200, { ok: true })
  } catch (error) {
    console.error('[send-telegram] failed', error)
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
})
