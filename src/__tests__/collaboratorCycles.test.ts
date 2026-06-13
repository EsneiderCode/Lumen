import { describe, it, expect, vi } from 'vitest'
import { addBusinessDays, reviewEndDate, defaultPaymentDate } from '@/lib/businessDays'

// The service imports the real supabase client at module load, which throws
// without env vars. We only test its PURE helpers here, so stub the client.
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

import {
  resolvePaymentDate,
  filterVisibleToContractor,
  type CollaboratorCycle,
} from '@/services/collaboratorCyclesService'

describe('businessDays — addBusinessDays (D3, weekends excluded, no holidays)', () => {
  it('returns the start unchanged for n = 0', () => {
    expect(addBusinessDays('2026-04-10', 0)).toBe('2026-04-10')
  })

  it('skips the weekend: Friday + 3 business days → Wednesday', () => {
    // 2026-04-10 is a Friday → Mon 13, Tue 14, Wed 15
    expect(addBusinessDays('2026-04-10', 3)).toBe('2026-04-15')
  })

  it('counts plain weekdays without skipping when no weekend is crossed', () => {
    // 2026-04-13 is a Monday → +2 → Wednesday 15
    expect(addBusinessDays('2026-04-13', 2)).toBe('2026-04-15')
  })

  it('skips a weekend that falls mid-range starting on a weekday', () => {
    // 2026-04-09 is a Thursday → Fri 10, (skip Sat/Sun) Mon 13
    expect(addBusinessDays('2026-04-09', 2)).toBe('2026-04-13')
  })

  it('treats negative n as 0', () => {
    expect(addBusinessDays('2026-04-10', -5)).toBe('2026-04-10')
  })
})

describe('reviewEndDate — review window = start + 3 business days', () => {
  it('derives the 3-business-day end', () => {
    expect(reviewEndDate('2026-04-10')).toBe('2026-04-15')
  })

  it('returns null when no start date is set', () => {
    expect(reviewEndDate(null)).toBeNull()
  })
})

describe('defaultPaymentDate — D4 = final cert + 20 calendar days', () => {
  it('adds 20 calendar days (weekends included)', () => {
    expect(defaultPaymentDate('2026-04-20')).toBe('2026-05-10')
  })

  it('returns null when no cert date is set', () => {
    expect(defaultPaymentDate(null)).toBeNull()
  })
})

describe('resolvePaymentDate — D4 recalc behaviour', () => {
  it('re-fixes payment to cert + 20 whenever the cert date is set/changed', () => {
    // even with a manual payment value in the same patch, the cert wins
    expect(resolvePaymentDate('2026-04-20', '2026-12-31')).toBe('2026-05-10')
  })

  it('clears the payment date when the cert date is cleared', () => {
    expect(resolvePaymentDate(null, '2026-05-10')).toBeNull()
  })

  it('keeps the explicit payment date when the cert date is NOT in the patch', () => {
    // final_cert_date === undefined → manual payment edit is allowed
    expect(resolvePaymentDate(undefined, '2026-05-15')).toBe('2026-05-15')
  })

  it('returns undefined when neither cert nor payment is provided (no-op patch)', () => {
    expect(resolvePaymentDate(undefined, undefined)).toBeUndefined()
  })
})

describe('filterVisibleToContractor — publish gate (RLS mirror)', () => {
  const CONTRACTOR_A = 'aaaa0000-0000-0000-0000-000000000001'
  const CONTRACTOR_B = 'bbbb0000-0000-0000-0000-000000000002'

  function cycle(over: Partial<CollaboratorCycle>): CollaboratorCycle {
    return {
      id: 'x',
      collaborator_id: CONTRACTOR_A,
      period_start: '2026-04-01',
      period_end: '2026-04-30',
      period_label: null,
      emission_date: null,
      review_start_date: null,
      final_cert_date: null,
      payment_date: null,
      status: 'published',
      published_at: null,
      published_by: null,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
      ...over,
    }
  }

  it('shows only published cycles owned by the contractor', () => {
    const rows = [
      cycle({ id: '1', status: 'published', collaborator_id: CONTRACTOR_A }),
      cycle({ id: '2', status: 'draft', collaborator_id: CONTRACTOR_A }),
      cycle({ id: '3', status: 'published', collaborator_id: CONTRACTOR_B }),
    ]
    const visible = filterVisibleToContractor(rows, CONTRACTOR_A)
    expect(visible.map((c) => c.id)).toEqual(['1'])
  })

  it('hides draft cycles even when owned by the contractor', () => {
    const rows = [cycle({ id: '2', status: 'draft', collaborator_id: CONTRACTOR_A })]
    expect(filterVisibleToContractor(rows, CONTRACTOR_A)).toHaveLength(0)
  })
})
