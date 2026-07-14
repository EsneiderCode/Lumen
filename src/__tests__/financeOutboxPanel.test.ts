import { describe, expect, it } from 'vitest'
import {
  OUTBOX_STATUSES,
  OUTBOX_STATUS_FILTERS,
  canRetryStatus,
  formatDateTime,
  statusBadgeClass,
  truncateError,
} from '@/lib/outboxFormat'

describe('finance outbox panel — status filters', () => {
  it('exposes the admin filter set (processing only visible under "all")', () => {
    expect(OUTBOX_STATUS_FILTERS).toEqual(['all', 'pending', 'failed', 'dead', 'sent'])
  })

  it('every non-"all" filter is a real outbox status', () => {
    for (const f of OUTBOX_STATUS_FILTERS.filter((f) => f !== 'all')) {
      expect(OUTBOX_STATUSES).toContain(f)
    }
  })
})

describe('finance outbox panel — status badge', () => {
  it('maps every outbox status to a distinct badge class', () => {
    const classes = OUTBOX_STATUSES.map((s) => statusBadgeClass(s))
    expect(new Set(classes).size).toBe(OUTBOX_STATUSES.length)
    for (const c of classes) expect(c.length).toBeGreaterThan(0)
  })

  it('falls back to a neutral class for unknown statuses', () => {
    expect(statusBadgeClass('weird')).toBe('border-line text-fg-3')
  })

  it('colors terminal failures with the error token', () => {
    expect(statusBadgeClass('failed')).toContain('text-err')
    expect(statusBadgeClass('dead')).toContain('text-err')
    expect(statusBadgeClass('sent')).toContain('text-ok')
  })
})

describe('finance outbox panel — retry eligibility', () => {
  it('only failed and dead rows are retryable', () => {
    expect(canRetryStatus('failed')).toBe(true)
    expect(canRetryStatus('dead')).toBe(true)
    expect(canRetryStatus('pending')).toBe(false)
    expect(canRetryStatus('processing')).toBe(false)
    expect(canRetryStatus('sent')).toBe(false)
  })
})

describe('finance outbox panel — truncateError', () => {
  it('returns empty string for null', () => {
    expect(truncateError(null)).toBe('')
  })

  it('keeps short messages intact and collapses whitespace', () => {
    expect(truncateError('Firestore  query\nfailed')).toBe('Firestore query failed')
  })

  it('truncates long messages with an ellipsis at the max length', () => {
    const long = 'x'.repeat(200)
    const out = truncateError(long, 80)
    expect(out.length).toBe(80)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('finance outbox panel — formatDateTime', () => {
  it('renders an em dash for null and invalid input', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('not-a-date')).toBe('—')
  })

  it('renders a localized date-time for valid ISO input', () => {
    const out = formatDateTime('2026-07-14T10:23:45.000Z')
    expect(out).not.toBe('—')
    expect(out).toContain('2026')
  })
})
