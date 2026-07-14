/**
 * Pure presentation helpers for the finance outbox admin panel (S6).
 * No supabase imports — unit-testable (see financeOutboxPanel.test.ts).
 */

export const OUTBOX_STATUSES = ['pending', 'processing', 'sent', 'failed', 'dead'] as const
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number]

/** Filter choices shown in the panel; `processing` rows appear under "all". */
export const OUTBOX_STATUS_FILTERS = ['all', 'pending', 'failed', 'dead', 'sent'] as const
export type OutboxStatusFilter = (typeof OUTBOX_STATUS_FILTERS)[number]

const BADGE_CLASSES: Record<OutboxStatus, string> = {
  pending: 'border-warn/40 text-warn',
  processing: 'border-accent/40 text-accent',
  sent: 'border-ok/40 text-ok',
  failed: 'border-err/40 text-err',
  dead: 'border-err bg-err/10 text-err',
}

export function statusBadgeClass(status: string): string {
  return BADGE_CLASSES[status as OutboxStatus] ?? 'border-line text-fg-3'
}

/** Only failed/dead rows can be re-queued; the rest are in flight or done. */
export function canRetryStatus(status: string): boolean {
  return status === 'failed' || status === 'dead'
}

/** Collapse whitespace and truncate for the table cell (full text via expand). */
export function truncateError(text: string | null, max = 80): string {
  if (!text) return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`
}

/** ISO timestamp → localized short date-time (de-DE), or an em dash. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
