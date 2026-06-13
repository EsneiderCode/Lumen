import { CORS_HEADERS, env, json, supabaseFetch } from '../_shared/http.ts'

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

// ── Types ────────────────────────────────────────────────────────────────────

interface AuthUserResponse {
  id?: string
}

type ProfileRow = Record<string, unknown> & {
  role: 'admin' | 'technician' | 'contractor'
  is_active: boolean
}

type TelegramEventType =
  | 'order_returned_for_correction'
  | 'task_assigned'
  | 'order_status_changed'

interface TelegramBody {
  /** Special action — not a notification send */
  action?: 'validate_chat'
  /** Used with action=validate_chat */
  chatId?: string
  /** Notification event type */
  type?: TelegramEventType
  orderNumber?: string
  reason?: string
  adminName?: string
  /** task_assigned: team assigned */
  assignedTo?: string
  /** task_assigned: technician name */
  technicianName?: string
  /** task_assigned: previous team (reassignment) */
  previousTeam?: string
  /** task_assigned: previous technician (reassignment) */
  previousTechnician?: string
  /** task_assigned: work type label */
  workType?: string
  /** task_assigned: assignment date */
  assignedDate?: string
  /** task_assigned: work order address */
  address?: string
  /** task_assigned: direct link to the order */
  orderUrl?: string
  /** order_status_changed: human-readable new status */
  newStatus?: string
}

interface GroupRow {
  chat_id: string
}

interface MappingRow {
  telegram_group_id: string
}

// ── Field limits (prevent oversized Telegram messages) ────────────────────────

const MAX = {
  orderNumber:        120,
  reason:             3_000,
  adminName:          120,
  assignedTo:         120,
  technicianName:     120,
  previousTeam:       120,
  previousTechnician: 120,
  workType:           120,
  assignedDate:       20,
  address:            200,
  orderUrl:           512,
  newStatus:          120,
  chatId:             64,
} as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function readBody(value: unknown): TelegramBody {
  if (!value || typeof value !== 'object') return {}
  const b = value as Record<string, unknown>
  return {
    action:      typeof b.action      === 'string' ? (b.action as TelegramBody['action']) : undefined,
    chatId:      typeof b.chatId      === 'string' ? b.chatId      : undefined,
    type:        typeof b.type        === 'string' ? (b.type as TelegramEventType) : undefined,
    orderNumber:        typeof b.orderNumber        === 'string' ? b.orderNumber        : undefined,
    reason:             typeof b.reason             === 'string' ? b.reason             : undefined,
    adminName:          typeof b.adminName          === 'string' ? b.adminName          : undefined,
    assignedTo:         typeof b.assignedTo         === 'string' ? b.assignedTo         : undefined,
    technicianName:     typeof b.technicianName     === 'string' ? b.technicianName     : undefined,
    previousTeam:       typeof b.previousTeam       === 'string' ? b.previousTeam       : undefined,
    previousTechnician: typeof b.previousTechnician === 'string' ? b.previousTechnician : undefined,
    workType:           typeof b.workType           === 'string' ? b.workType           : undefined,
    assignedDate:       typeof b.assignedDate       === 'string' ? b.assignedDate       : undefined,
    address:            typeof b.address            === 'string' ? b.address            : undefined,
    orderUrl:           typeof b.orderUrl           === 'string' ? b.orderUrl           : undefined,
    newStatus:          typeof b.newStatus          === 'string' ? b.newStatus          : undefined,
  }
}

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function trim(v: string | undefined, max: number): string | undefined {
  const t = v?.trim()
  if (!t) return undefined
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAdmin(
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<Response | null> {
  const auth = req.headers.get('authorization')
  if (!auth) return json(401, { error: 'Missing authorization' })

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, authorization: auth },
  })
  if (!userRes.ok) return json(401, { error: 'Invalid authorization' })

  const authUser = (await userRes.json()) as AuthUserResponse
  if (!authUser.id) return json(401, { error: 'Invalid authorization' })

  const profiles = await supabaseFetch<ProfileRow[]>(
    supabaseUrl,
    serviceRoleKey,
    `profiles?select=role,is_active&id=eq.${encodeURIComponent(authUser.id)}&limit=1`,
    { method: 'GET' },
  )
  const profile = profiles[0] ?? null
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return json(403, { error: 'Admin access required' })
  }
  return null
}

// ── Message builders ──────────────────────────────────────────────────────────

function buildMessage(body: TelegramBody): string | null {
  const orderNumber = trim(body.orderNumber, MAX.orderNumber)
  const adminName   = trim(body.adminName,   MAX.adminName)
  const who         = adminName ? ` por <b>${esc(adminName)}</b>` : ''

  switch (body.type) {
    case 'order_returned_for_correction': {
      const reason = trim(body.reason, MAX.reason)
      if (!orderNumber || !reason) return null
      return (
        `⚠️ <b>Orden devuelta para corrección</b>\n\n` +
        `🔖 OS: <b>${esc(orderNumber)}</b>\n` +
        `👤 Devuelta${who}\n\n` +
        `📋 <b>Motivo:</b>\n${esc(reason)}`
      )
    }

    case 'task_assigned': {
      const assignedTo         = trim(body.assignedTo,         MAX.assignedTo)
      const technicianName     = trim(body.technicianName,     MAX.technicianName)
      const previousTeam       = trim(body.previousTeam,       MAX.previousTeam)
      const previousTechnician = trim(body.previousTechnician, MAX.previousTechnician)
      const workType           = trim(body.workType,           MAX.workType)
      const assignedDate       = trim(body.assignedDate,       MAX.assignedDate)
      const address            = trim(body.address,            MAX.address)
      const orderUrl           = trim(body.orderUrl,           MAX.orderUrl)
      if (!orderNumber || !assignedTo) return null

      const isReassign = !!previousTeam
      const title = isReassign ? '🔄 <b>Orden reasignada</b>' : '📋 <b>Nueva asignación</b>'

      const lines: string[] = [
        title,
        '',
        `🔖 OS: <b>${esc(orderNumber)}</b>`,
      ]

      if (workType) lines.push(`🔧 Tipo: <b>${esc(workType)}</b>`)
      if (address) lines.push(`📍 Dirección: ${esc(address)}`)
      if (assignedDate) lines.push(`📅 Fecha: <b>${esc(assignedDate)}</b>`)

      lines.push('')
      lines.push(`👷 Equipo: <b>${esc(assignedTo)}</b>`)
      if (technicianName) lines.push(`👤 Técnico responsable: <b>${esc(technicianName)}</b>`)

      if (isReassign) {
        lines.push('')
        lines.push(`⬅️ Antes: <b>${esc(previousTeam!)}</b>${previousTechnician ? ` (${esc(previousTechnician)})` : ''}`)
      }

      if (who) {
        lines.push('')
        lines.push(`✏️ Asignada${who}`)
      }

      if (orderUrl) lines.push(`\n🔗 <a href="${orderUrl}">Ver orden</a>`)

      return lines.join('\n')
    }

    case 'order_status_changed': {
      const newStatus = trim(body.newStatus, MAX.newStatus)
      if (!orderNumber || !newStatus) return null
      const reason    = trim(body.reason, MAX.reason)
      const reasonLine = reason ? `\n\n📋 <b>Detalle:</b>\n${esc(reason)}` : ''
      return (
        `🔄 <b>Cambio en orden</b>\n\n` +
        `🔖 OS: <b>${esc(orderNumber)}</b>\n` +
        `📌 Estado: <b>${esc(newStatus)}</b>\n` +
        `👤 Actualizado${who}` +
        reasonLine
      )
    }

    default:
      return null
  }
}

// ── Chat validation ───────────────────────────────────────────────────────────

async function handleValidateChat(body: TelegramBody, botToken: string): Promise<Response> {
  const chatId = trim(body.chatId, MAX.chatId)
  if (!chatId) return json(400, { error: 'chatId is required' })

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`,
  )
  const data = await res.json() as { ok: boolean; result?: { title?: string; first_name?: string } }

  if (!data.ok) return json(200, { ok: false })

  const title = data.result?.title ?? data.result?.first_name ?? chatId
  return json(200, { ok: true, title })
}

// ── Group lookup ──────────────────────────────────────────────────────────────

async function resolveGroups(
  eventType: TelegramEventType,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<string[]> {
  const mappings = await supabaseFetch<MappingRow[]>(
    supabaseUrl,
    serviceRoleKey,
    `event_group_mappings?select=telegram_group_id&event_type=eq.${encodeURIComponent(eventType)}&is_active=eq.true`,
    { method: 'GET' },
  )
  if (!mappings.length) return []

  const ids = mappings.map((m) => m.telegram_group_id).join(',')
  const groups = await supabaseFetch<GroupRow[]>(
    supabaseUrl,
    serviceRoleKey,
    `telegram_groups?select=chat_id&id=in.(${ids})&is_active=eq.true`,
    { method: 'GET' },
  )
  return groups.map((g) => g.chat_id)
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const supabaseUrl    = env('SUPABASE_URL')
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')
    const botToken       = env('TELEGRAM_BOT_TOKEN')

    const adminError = await requireAdmin(req, supabaseUrl, serviceRoleKey)
    if (adminError) return adminError

    const body = readBody(await req.json().catch(() => null))

    // ── validate_chat action ─────────────────────────────────────────────────
    if (body.action === 'validate_chat') {
      return await handleValidateChat(body, botToken)
    }

    // ── notification send ────────────────────────────────────────────────────
    if (!body.type) return json(400, { error: 'Missing type' })

    const text = buildMessage(body)
    if (!text) return json(400, { error: 'Invalid notification payload' })

    const chatIds = await resolveGroups(body.type, supabaseUrl, serviceRoleKey)
    if (!chatIds.length) {
      console.warn('[send-telegram] no active groups for event:', body.type)
      return json(200, { ok: true, sent: 0 })
    }

    const results = await Promise.allSettled(
      chatIds.map((chatId) =>
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        }).then(async (r) => {
          if (!r.ok) throw new Error(await r.text())
        }),
      ),
    )

    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length) {
      failures.forEach((f) =>
        console.error('[send-telegram] delivery failed', (f as PromiseRejectedResult).reason),
      )
    }

    const sent = results.length - failures.length
    return json(200, { ok: true, sent, failed: failures.length })
  } catch (error) {
    console.error('[send-telegram] unexpected error', error)
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
})
