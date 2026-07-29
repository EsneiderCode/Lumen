// Cómo se nombra una orden de obra en una lista.
//
// El número (LUM-20260729-1042) identifica la orden pero no dice nada del
// trabajo, y el tipo solo (`soplado`) tampoco: veinte soplados seguidos son
// veinte filas idénticas. Lo que identifica el trabajo en obra es el tramo —
// de qué POP sale y a qué DP llega — y si es ramal de alimentación o de
// distribución. Ese dato vive en la orden desde la migración 064
// (`segment_kind`, `pop_code`, `dp_code`).
//
// Este módulo es el único sitio donde se compone la etiqueta. Lo usan la lista
// de administración, la del técnico, la del subcontratista, el detalle, la
// exportación de certificación y los avisos de Telegram, y todos tienen que
// decir exactamente lo mismo: si el técnico ve «QFF001-DP021» en el móvil y el
// grupo de Telegram ve otra cosa, la referencia deja de servir para hablar.
//
// El equivalente en la Edge Function `send-telegram` está duplicado a mano
// (Deno no comparte módulos con el bundle de Vite); `orderSiteRef.test.ts`
// compara las dos implementaciones para que no se separen.

export const SEGMENT_KINDS = ['ra', 'rd'] as const

/** Tramo de la obra: ramal de alimentación (POP→DP) o de distribución. */
export type SegmentKind = (typeof SEGMENT_KINDS)[number]

export function isSegmentKind(value: unknown): value is SegmentKind {
  return typeof value === 'string' && (SEGMENT_KINDS as readonly string[]).includes(value)
}

/**
 * Normaliza un código de POP o DP tal como se teclea.
 *
 * Se guarda sin el prefijo del proyecto ni el `DP`: el proyecto ya está en la
 * orden y el prefijo lo pone la etiqueta. Un código puramente numérico se
 * rellena a tres dígitos porque así se numeran en obra y porque, si no, «1» y
 * «001» serían dos POPs distintos para el buscador. Uno con letras (un POP
 * provisional, un DP con sufijo) se respeta tal cual, solo en mayúsculas.
 */
export function normalizeSiteCode(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim().toUpperCase()
  if (!trimmed) return null
  return /^\d+$/.test(trimmed) ? trimmed.padStart(3, '0') : trimmed
}

export interface OrderSiteRefSource {
  pop_code?: string | null
  dp_code?: string | null
  projects?: { code?: string | null } | null
}

/**
 * La referencia de obra: «QFF001-DP021».
 *
 * Con solo el POP → «QFF001». Con solo el DP → «QFF-DP021»: el proyecto se
 * queda porque un DP 021 suelto no significa nada fuera del suyo. Sin ninguno
 * de los dos → null, y quien la pinte cae a lo que tuviera antes (la dirección,
 * o nada).
 */
export function orderSiteRef(order: OrderSiteRefSource): string | null {
  const project = order.projects?.code?.trim() ?? ''
  const pop = normalizeSiteCode(order.pop_code)
  const dp = normalizeSiteCode(order.dp_code)
  if (!pop && !dp) return null

  const head = `${project}${pop ?? ''}`
  const tail = dp ? `DP${dp}` : ''
  return [head, tail].filter(Boolean).join('-')
}

export interface OrderTypeLabelSource {
  segment_kind?: string | null
}

/**
 * «Soplado» + tramo → «Soplado RA».
 *
 * Recibe las etiquetas ya traducidas en vez de traducir aquí, porque este
 * módulo también corre fuera del árbol de React (PDF, exportaciones) y la
 * i18n vive en `labels.ts`.
 */
export function orderTypeLabel(
  order: OrderTypeLabelSource,
  workTypeLabel: string,
  segmentLabel: (kind: SegmentKind) => string,
): string {
  const kind = order.segment_kind
  if (!isSegmentKind(kind)) return workTypeLabel
  return `${workTypeLabel} ${segmentLabel(kind)}`
}
