import { CORS_HEADERS, env, json, supabaseFetch, userIdFromJwt } from '../_shared/http.ts'

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

// ── Types ────────────────────────────────────────────────────────────────────

type ProfileRow = Record<string, unknown> & {
  role: 'admin' | 'technician' | 'contractor'
  is_active: boolean
}

type TelegramEventType =
  | 'order_returned_for_correction'
  | 'task_assigned'
  | 'order_status_changed'
  | 'order_cancelled'
  | 'order_deleted'
  | 'report_submitted'

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
  /** report_submitted: technician name */
  techName?: string
  /** report_submitted: city */
  city?: string
  /** report_submitted: summary / result */
  summary?: string
  /** report_submitted: technician notes */
  techNotes?: string
  /**
   * Id of the work order the event concerns. When the order has rows in
   * work_order_telegram_groups, delivery targets ONLY those groups;
   * otherwise event_group_mappings applies.
   */
  orderId?: string
  /**
   * Comma-separated telegram_groups ids resolved by the caller BEFORE the
   * order was deleted (order_deleted only — the join rows cascade away with
   * the order). Ignored for open events; ids are validated against
   * telegram_groups, so delivery is always limited to registered groups.
   */
  groupIds?: string
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
  techName:           120,
  city:               200,
  summary:            500,
  techNotes:          1_000,
  orderId:            64,
  groupIds:           2_000,
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
    techName:           typeof b.techName           === 'string' ? b.techName           : undefined,
    city:               typeof b.city               === 'string' ? b.city               : undefined,
    summary:            typeof b.summary            === 'string' ? b.summary            : undefined,
    techNotes:          typeof b.techNotes          === 'string' ? b.techNotes          : undefined,
    orderId:            typeof b.orderId            === 'string' ? b.orderId            : undefined,
    groupIds:           typeof b.groupIds           === 'string' ? b.groupIds           : undefined,
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function trim(v: string | undefined, max: number): string | undefined {
  const t = v?.trim()
  if (!t) return undefined
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

// ── Auth guard ────────────────────────────────────────────────────────────────

/** Event types that any authenticated user (not just admin) can trigger. */
const OPEN_EVENT_TYPES: Set<string> = new Set(['report_submitted'])

async function requireAuth(
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
  eventType?: string,
): Promise<Response | null> {
  const auth = req.headers.get('authorization')
  if (!auth) return json(401, { error: 'Missing authorization' })

  const userId = userIdFromJwt(auth)
  if (!userId) return json(401, { error: 'Invalid authorization' })

  const profiles = await supabaseFetch<ProfileRow[]>(
    supabaseUrl,
    serviceRoleKey,
    `profiles?select=role,is_active&id=eq.${encodeURIComponent(userId)}&limit=1`,
    { method: 'GET' },
  )
  const profile = profiles[0] ?? null
  if (!profile || !profile.is_active) {
    return json(403, { error: 'Active profile required' })
  }

  // Open events allow any authenticated user; all others require admin
  if (!eventType || !OPEN_EVENT_TYPES.has(eventType)) {
    if (profile.role !== 'admin') {
      return json(403, { error: 'Admin access required' })
    }
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
      // Direct-to-technician assignments carry no team: require at least one target.
      if (!orderNumber || (!assignedTo && !technicianName)) return null

      const isReassign = !!previousTeam || !!previousTechnician
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
      if (assignedTo) lines.push(`👷 Equipo: <b>${esc(assignedTo)}</b>`)
      if (technicianName) lines.push(`👤 Técnico responsable: <b>${esc(technicianName)}</b>`)

      if (isReassign) {
        lines.push('')
        const before = previousTeam
          ? `<b>${esc(previousTeam)}</b>${previousTechnician ? ` (${esc(previousTechnician)})` : ''}`
          : `<b>${esc(previousTechnician!)}</b>`
        lines.push(`⬅️ Antes: ${before}`)
        const reason = trim(body.reason, MAX.reason)
        if (reason) {
          lines.push(`📋 Motivo: ${esc(reason)}`)
        }
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

    case 'order_cancelled': {
      if (!orderNumber) return null
      const reason = trim(body.reason, MAX.reason)
      const reasonLine = reason ? `\n\n📋 <b>Motivo:</b>\n${esc(reason)}` : ''
      return (
        `❌ <b>Orden cancelada</b>\n\n` +
        `🔖 OS: <b>${esc(orderNumber)}</b>\n` +
        `👤 Cancelada${who}` +
        reasonLine
      )
    }

    case 'report_submitted': {
      const techName  = trim(body.techName,  MAX.techName)
      const address   = trim(body.address,   MAX.address)
      const city      = trim(body.city,      MAX.city)
      const summary   = trim(body.summary,   MAX.summary)
      const techNotes = trim(body.techNotes,  MAX.techNotes)
      const workType  = trim(body.workType,  MAX.workType)
      const orderUrl  = trim(body.orderUrl,  MAX.orderUrl)
      if (!orderNumber) return null

      const lines: string[] = [
        `📝 <b>Reporte registrado</b>`,
        '',
        `🔖 OS: <b>${esc(orderNumber)}</b>`,
      ]

      if (workType) lines.push(`🔧 Tipo: <b>${esc(workType)}</b>`)
      if (techName) lines.push(`👤 Técnico: <b>${esc(techName)}</b>`)

      const location = [address, city].filter(Boolean).join(', ')
      if (location) lines.push(`📍 ${esc(location)}`)

      if (summary) {
        lines.push('')
        lines.push(`📋 <b>Resumen:</b> ${esc(summary)}`)
      }

      if (techNotes && techNotes !== summary) {
        lines.push(`📌 <b>Notas:</b> ${esc(techNotes)}`)
      }

      if (orderUrl) lines.push(`\n🔗 <a href="${orderUrl}">Ver reporte</a>`)

      return lines.join('\n')
    }

    case 'order_deleted': {
      if (!orderNumber) return null
      const assignedTo     = trim(body.assignedTo,     MAX.assignedTo)
      const technicianName = trim(body.technicianName, MAX.technicianName)
      const workType       = trim(body.workType,       MAX.workType)
      const address        = trim(body.address,        MAX.address)

      const lines: string[] = [
        `🗑️ <b>Orden eliminada</b>`,
        '',
        `🔖 OS: <b>${esc(orderNumber)}</b>`,
      ]

      if (workType) lines.push(`🔧 Tipo: <b>${esc(workType)}</b>`)
      if (address) lines.push(`📍 Dirección: ${esc(address)}`)
      if (assignedTo) {
        lines.push('')
        lines.push(`👷 Equipo: <b>${esc(assignedTo)}</b>`)
        if (technicianName) lines.push(`👤 Técnico responsable: <b>${esc(technicianName)}</b>`)
      }

      lines.push('')
      lines.push(`👤 Eliminada${who}`)

      return lines.join('\n')
    }

    default:
      return null
  }
}

// ── Order card enrichment ─────────────────────────────────────────────────────
// When the payload carries an orderId, the message is built server-side from
// the live order: project/client/operator, address, priority, status, team
// with its member list, notes, and attached documents. The payload-based
// buildMessage above stays as fallback (order_deleted, lookup failures).

const WORK_TYPE_LABELS: Record<string, string> = {
  soplado: 'Soplado',
  fusion_ap: 'Fusión AP',
  fusion_dp: 'Fusión DP',
  alta: 'Alta',
  nt_installation: 'Instalación NT',
  patchkabel: 'Patchkabel',
  pop: 'Instalación POP',
}

const STATUS_LABELS: Record<string, string> = {
  created: 'Creada',
  assigned: 'Asignada',
  in_progress: 'En curso',
  executed: 'Ejecutada',
  rueckmeldung_pending: 'Rückmeldung pendiente',
  rueckmeldung_sent: 'Rückmeldung enviada',
  internally_certified: 'Certificada internamente',
  sent_to_client: 'Enviada al cliente',
  client_accepted: 'Aceptada por cliente',
  client_rejected: 'Rechazada por cliente',
  invoiced: 'Facturada',
  paid: 'Pagada',
  returned: 'Requiere corrección',
  cancelled: 'Cancelada',
}

const PRIORITY_LABELS: Record<string, string> = {
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

// Field teams go by their German color names (Rot, Weiß, …).
const TEAM_LABELS: Record<string, string> = {
  rot: 'Rot',
  gruen: 'Grün',
  blau: 'Blau',
  gelb: 'Gelb',
  weiss: 'Weiß',
  grau: 'Grau',
  braun: 'Braun',
  violett: 'Violett',
  tuerkis: 'Türkis',
  schwarz: 'Schwarz',
  orange: 'Orange',
  rosa: 'Rosa',
}

function label(map: Record<string, string>, value: string): string {
  return map[value] ?? value
}

interface OrderCardRow {
  id: string
  order_number: string
  work_type: string
  status: string
  priority: string
  line: string
  address: string | null
  postal_code: string | null
  city: string | null
  assigned_date: string | null
  internal_notes: string | null
  assigned_team: string | null
  assigned_technician: string | null
  clients: { name: string; code: string } | null
  projects: { name: string; code: string } | null
  operators: { name: string; code: string } | null
}

interface TeamMemberRow {
  id: string
  full_name: string
  role: string
}

interface DocumentRow {
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
}

interface OrderCard {
  order: OrderCardRow
  members: TeamMemberRow[]
  responsibleName: string | null
  documents: DocumentRow[]
}

async function fetchOrderCard(
  orderId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<OrderCard | null> {
  try {
    const rows = await supabaseFetch<OrderCardRow[]>(
      supabaseUrl,
      serviceRoleKey,
      `work_orders?select=id,order_number,work_type,status,priority,line,address,postal_code,city,assigned_date,internal_notes,assigned_team,assigned_technician,clients(name,code),projects(name,code),operators(name,code)&id=eq.${encodeURIComponent(orderId)}&limit=1`,
      { method: 'GET' },
    )
    const order = rows[0]
    if (!order) return null

    let members: TeamMemberRow[] = []
    if (order.assigned_team) {
      members = await supabaseFetch<TeamMemberRow[]>(
        supabaseUrl,
        serviceRoleKey,
        `profiles?select=id,full_name,role&team=eq.${encodeURIComponent(order.assigned_team)}&is_active=eq.true&role=in.(technician,contractor)&order=full_name`,
        { method: 'GET' },
      )
    }

    let responsibleName =
      members.find((m) => m.id === order.assigned_technician)?.full_name ?? null
    if (!responsibleName && order.assigned_technician) {
      const profiles = await supabaseFetch<TeamMemberRow[]>(
        supabaseUrl,
        serviceRoleKey,
        `profiles?select=id,full_name,role&id=eq.${encodeURIComponent(order.assigned_technician)}&limit=1`,
        { method: 'GET' },
      )
      responsibleName = profiles[0]?.full_name ?? null
    }

    const documents = await supabaseFetch<DocumentRow[]>(
      supabaseUrl,
      serviceRoleKey,
      `work_order_documents?select=file_name,storage_path,mime_type,size_bytes&work_order_id=eq.${encodeURIComponent(orderId)}&order=uploaded_at.asc`,
      { method: 'GET' },
    )

    return { order, members, responsibleName, documents }
  } catch (error) {
    console.error('[send-telegram] order card fetch failed', error)
    return null
  }
}

/** The shared order card: identifies the order fully, no matter the project. */
function buildCardText(card: OrderCard): string {
  const o = card.order
  const lines: string[] = [`🔖 OS: <b>${esc(o.order_number)}</b>`]

  if (o.projects) {
    lines.push(`🏗 Proyecto: <b>${esc(`${o.projects.code} — ${o.projects.name}`)}</b>`)
  }
  const context = [
    o.clients ? `Cliente: ${o.clients.name} (${o.clients.code})` : 'Orden directa (sin cliente)',
    o.operators ? `Operador: ${o.operators.code}` : null,
    o.line || null,
  ]
    .filter(Boolean)
    .join(' · ')
  lines.push(`🏢 ${esc(context)}`)

  const fire = o.priority === 'urgente' ? ' 🔥' : ''
  lines.push(
    `🔧 Tipo: <b>${esc(label(WORK_TYPE_LABELS, o.work_type))}</b>` +
      ` · Prioridad: <b>${esc(label(PRIORITY_LABELS, o.priority))}</b>${fire}`,
  )
  lines.push(`📌 Estado: <b>${esc(label(STATUS_LABELS, o.status))}</b>`)

  const location = [o.address, [o.postal_code, o.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  if (location) lines.push(`📍 Dirección: ${esc(location)}`)
  if (o.assigned_date) lines.push(`📅 Fecha asignada: <b>${esc(o.assigned_date)}</b>`)

  if (o.assigned_team) {
    lines.push('')
    lines.push(`👷 Equipo: <b>${esc(label(TEAM_LABELS, o.assigned_team))}</b>`)
    if (card.members.length) {
      for (const m of card.members) {
        const star = m.id === o.assigned_technician ? ' ⭐' : ''
        const tag = m.role === 'contractor' ? ' (subcontrata)' : ''
        lines.push(`   • ${esc(m.full_name)}${tag}${star}`)
      }
    } else {
      lines.push('   • Sin miembros activos')
    }
    if (card.responsibleName) {
      lines.push(`⭐ Responsable: <b>${esc(card.responsibleName)}</b>`)
    }
  } else if (card.responsibleName) {
    lines.push('')
    lines.push(`👤 Técnico responsable: <b>${esc(card.responsibleName)}</b>`)
  }

  const notes = trim(o.internal_notes ?? undefined, 800)
  if (notes) {
    lines.push('')
    lines.push(`📝 <b>Notas:</b> ${esc(notes)}`)
  }

  if (card.documents.length) {
    const names = trim(card.documents.map((d) => d.file_name).join(', '), 300)
    lines.push('')
    lines.push(`📎 Documentos (${card.documents.length}): ${esc(names ?? '')}`)
  }

  return lines.join('\n')
}

/** Event header + order card + event-specific details. */
function buildRichMessage(body: TelegramBody, card: OrderCard): string | null {
  const adminName = trim(body.adminName, MAX.adminName)
  const who = adminName ? ` por <b>${esc(adminName)}</b>` : ''
  const reason = trim(body.reason, MAX.reason)
  const orderUrl = trim(body.orderUrl, MAX.orderUrl)

  let header: string
  const extra: string[] = []

  switch (body.type) {
    case 'task_assigned': {
      const previousTeam = trim(body.previousTeam, MAX.previousTeam)
      const previousTechnician = trim(body.previousTechnician, MAX.previousTechnician)
      const isReassign = !!previousTeam || !!previousTechnician
      header = isReassign ? '🔄 <b>Orden reasignada</b>' : '📋 <b>Nueva asignación</b>'
      if (isReassign) {
        const before = previousTeam
          ? `<b>${esc(previousTeam)}</b>${previousTechnician ? ` (${esc(previousTechnician)})` : ''}`
          : `<b>${esc(previousTechnician!)}</b>`
        extra.push(`⬅️ Antes: ${before}`)
        if (reason) extra.push(`📋 Motivo del cambio: ${esc(reason)}`)
      }
      if (adminName) extra.push(`👤 Asignada${who}`)
      break
    }

    case 'order_status_changed':
      header = '🔄 <b>Cambio en orden</b>'
      if (adminName) extra.push(`👤 Actualizado${who}`)
      if (reason) extra.push(`📋 <b>Detalle:</b> ${esc(reason)}`)
      break

    case 'order_cancelled':
      header = '❌ <b>Orden cancelada</b>'
      if (adminName) extra.push(`👤 Cancelada${who}`)
      if (reason) extra.push(`📋 <b>Motivo:</b> ${esc(reason)}`)
      break

    case 'order_returned_for_correction':
      header = '⚠️ <b>Orden devuelta para corrección</b>'
      if (adminName) extra.push(`👤 Devuelta${who}`)
      if (reason) extra.push(`📋 <b>Motivo:</b> ${esc(reason)}`)
      break

    case 'report_submitted': {
      header = '📝 <b>Reporte registrado</b>'
      const techName = trim(body.techName, MAX.techName)
      const summary = trim(body.summary, MAX.summary)
      const techNotes = trim(body.techNotes, MAX.techNotes)
      if (techName) extra.push(`👤 Técnico: <b>${esc(techName)}</b>`)
      if (summary) extra.push(`📋 <b>Resumen:</b> ${esc(summary)}`)
      if (techNotes && techNotes !== summary) {
        extra.push(`📌 <b>Notas del técnico:</b> ${esc(techNotes)}`)
      }
      break
    }

    // order_deleted keeps the payload-based message: the order is gone.
    default:
      return null
  }

  const parts = [header, '', buildCardText(card)]
  if (extra.length) {
    parts.push('')
    parts.push(...extra)
  }
  if (orderUrl) parts.push(`\n🔗 <a href="${orderUrl}">Ver orden en LUMEN</a>`)
  return parts.join('\n')
}

// ── Document delivery ─────────────────────────────────────────────────────────

const MAX_DOCUMENTS = 10
const MAX_DOCUMENT_BYTES = 45 * 1024 * 1024 // Telegram bot upload limit is 50 MB

/**
 * Sends the order's attached documents to every target chat, right after the
 * notification message. Each file is downloaded once from Storage and uploaded
 * to Telegram as multipart. Failures are logged per file and never abort the
 * remaining ones.
 */
async function sendDocuments(
  card: OrderCard,
  chatIds: string[],
  botToken: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<number> {
  let sent = 0
  for (const doc of card.documents.slice(0, MAX_DOCUMENTS)) {
    if ((doc.size_bytes ?? 0) > MAX_DOCUMENT_BYTES) {
      console.warn('[send-telegram] document too large, skipped', doc.storage_path)
      continue
    }
    try {
      const objectPath = doc.storage_path.split('/').map(encodeURIComponent).join('/')
      const res = await fetch(
        `${supabaseUrl}/storage/v1/object/work-order-documents/${objectPath}`,
        { headers: { authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey } },
      )
      if (!res.ok) throw new Error(`storage download failed (${res.status})`)
      const blob = await res.blob()

      for (const chatId of chatIds) {
        const form = new FormData()
        form.append('chat_id', chatId)
        form.append('document', blob, doc.file_name)
        form.append('caption', `📎 ${card.order.order_number} — ${doc.file_name}`)
        const tg = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
          method: 'POST',
          body: form,
        })
        if (tg.ok) sent += 1
        else console.error('[send-telegram] sendDocument failed', await tg.text())
      }
    } catch (error) {
      console.error('[send-telegram] document delivery failed', doc.storage_path, error)
    }
  }
  return sent
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

/** Map derived event types to their parent for group resolution. */
const EVENT_TYPE_FALLBACKS: Partial<Record<TelegramEventType, TelegramEventType>> = {
  order_cancelled: 'order_status_changed',
  order_deleted: 'order_status_changed',
}

/** Resolves chat_ids for a set of telegram_groups ids, active groups only. */
async function chatIdsForGroups(
  groupIds: string[],
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<string[]> {
  if (!groupIds.length) return []
  const groups = await supabaseFetch<GroupRow[]>(
    supabaseUrl,
    serviceRoleKey,
    `telegram_groups?select=chat_id&id=in.(${groupIds.join(',')})&is_active=eq.true`,
    { method: 'GET' },
  )
  return groups.map((g) => g.chat_id)
}

async function resolveGroups(
  eventType: TelegramEventType,
  orderId: string | undefined,
  explicitGroupIds: string[],
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<string[]> {
  // Order-scoped routing: if the order has assigned groups, deliver only to
  // those. Fall through to event mappings otherwise — including when the
  // lookup itself fails (e.g. migration 041 not applied yet), so a routing
  // problem never swallows the notification.
  if (orderId && UUID_RE.test(orderId)) {
    try {
      const assignments = await supabaseFetch<MappingRow[]>(
        supabaseUrl,
        serviceRoleKey,
        `work_order_telegram_groups?select=telegram_group_id&work_order_id=eq.${encodeURIComponent(orderId)}`,
        { method: 'GET' },
      )
      const chatIds = await chatIdsForGroups(
        assignments.map((m) => m.telegram_group_id),
        supabaseUrl,
        serviceRoleKey,
      )
      if (chatIds.length) return chatIds
    } catch (error) {
      console.error('[send-telegram] order group lookup failed', error)
    }
  }

  // order_deleted: the join rows cascade away with the order, so the caller
  // resolves the group ids beforehand and sends them explicitly.
  if (explicitGroupIds.length) {
    const chatIds = await chatIdsForGroups(explicitGroupIds, supabaseUrl, serviceRoleKey)
    if (chatIds.length) return chatIds
  }

  const lookupType = EVENT_TYPE_FALLBACKS[eventType] ?? eventType
  const mappings = await supabaseFetch<MappingRow[]>(
    supabaseUrl,
    serviceRoleKey,
    `event_group_mappings?select=telegram_group_id&event_type=eq.${encodeURIComponent(lookupType)}&is_active=eq.true`,
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

    const body = readBody(await req.json().catch(() => null))

    const authError = await requireAuth(req, supabaseUrl, serviceRoleKey, body.type ?? body.action)
    if (authError) return authError

    // ── validate_chat action ─────────────────────────────────────────────────
    if (body.action === 'validate_chat') {
      return await handleValidateChat(body, botToken)
    }

    // ── notification send ────────────────────────────────────────────────────
    if (!body.type) return json(400, { error: 'Missing type' })

    // Enrich from the live order when possible; fall back to the payload-only
    // message (order_deleted, missing orderId, lookup failure).
    const orderId = trim(body.orderId, MAX.orderId)
    const card = orderId && UUID_RE.test(orderId) && body.type !== 'order_deleted'
      ? await fetchOrderCard(orderId, supabaseUrl, serviceRoleKey)
      : null

    const text = (card ? buildRichMessage(body, card) : null) ?? buildMessage(body)
    if (!text) return json(400, { error: 'Invalid notification payload' })

    // Explicit group ids are only honored for admin-triggered events
    // (order_deleted); open events must route via orderId or fallback.
    const explicitGroupIds = OPEN_EVENT_TYPES.has(body.type)
      ? []
      : (trim(body.groupIds, MAX.groupIds) ?? '')
          .split(',')
          .map((v) => v.trim())
          .filter((v) => UUID_RE.test(v))

    const chatIds = await resolveGroups(body.type, orderId, explicitGroupIds, supabaseUrl, serviceRoleKey)
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

    // Deliver the order's attached files after the card, so the team receives
    // everything (plano, protocolos, …) in one go on assignment.
    let documentsSent = 0
    if (body.type === 'task_assigned' && card?.documents.length) {
      documentsSent = await sendDocuments(card, chatIds, botToken, supabaseUrl, serviceRoleKey)
    }

    const sent = results.length - failures.length
    return json(200, { ok: true, sent, failed: failures.length, documentsSent })
  } catch (error) {
    console.error('[send-telegram] unexpected error', error)
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
})
