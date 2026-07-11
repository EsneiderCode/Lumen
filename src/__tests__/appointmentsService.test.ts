import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

import {
  canTransition,
  listAppointments,
  createAppointment,
  confirmAppointment,
  completeAppointment,
  cancelAppointment,
  rescheduleAppointment,
  type Appointment,
} from '@/services/appointmentsService'

function makeAppointment(over: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appt-1',
    work_order_id: null,
    line: 'NE3',
    operator_id: 'op-dgf',
    scheduled_at: '2026-05-02T09:00:00.000Z',
    duration_min: 60,
    address: null,
    contact_name: null,
    contact_phone: null,
    status: 'proposed',
    notes: null,
    assigned_to: 'sched-1',
    created_by: 'sched-1',
    created_at: '2026-04-28T08:00:00.000Z',
    updated_at: '2026-04-28T08:00:00.000Z',
    ...over,
  }
}

/**
 * Build a chainable supabase mock that records eq() filters and resolves
 * select queries against an in-memory row set; insert/update echo the payload.
 */
function buildChain(rows: Appointment[]) {
  const eqCalls: Array<[string, unknown]> = []
  let payload: Record<string, unknown> | null = null

  const chain: Record<string, unknown> = {}
  const assign = (fn: () => unknown) => fn

  chain.select = vi.fn(() => chain)
  chain.order = vi.fn(() => Promise.resolve({ data: rows, error: null }))
  chain.eq = vi.fn((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return chain
  })
  chain.insert = vi.fn((p: Record<string, unknown>) => {
    payload = p
    return chain
  })
  chain.update = vi.fn((p: Record<string, unknown>) => {
    payload = p
    return chain
  })
  chain.single = vi.fn(() => {
    if (payload) {
      return Promise.resolve({ data: { ...makeAppointment(), ...payload, id: 'new-id' }, error: null })
    }
    const row = rows.find((r) =>
      eqCalls.every(([c, v]) => (r as unknown as Record<string, unknown>)[c] === v),
    )
    return Promise.resolve({ data: row ?? null, error: row ? null : { message: 'No rows found' } })
  })

  return { chain, eqCalls, getPayload: () => payload, assign }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Pure transition rules ─────────────────────────────────────────────────────

describe('canTransition', () => {
  it('allows proposed → confirmed → completed', () => {
    expect(canTransition('proposed', 'confirmed')).toBe(true)
    expect(canTransition('confirmed', 'completed')).toBe(true)
  })

  it('allows cancel from open states', () => {
    expect(canTransition('proposed', 'cancelled')).toBe(true)
    expect(canTransition('confirmed', 'cancelled')).toBe(true)
    expect(canTransition('rescheduled', 'cancelled')).toBe(true)
  })

  it('allows reschedule from proposed and confirmed', () => {
    expect(canTransition('proposed', 'rescheduled')).toBe(true)
    expect(canTransition('confirmed', 'rescheduled')).toBe(true)
  })

  it('treats completed and cancelled as terminal', () => {
    expect(canTransition('completed', 'confirmed')).toBe(false)
    expect(canTransition('completed', 'cancelled')).toBe(false)
    expect(canTransition('cancelled', 'confirmed')).toBe(false)
  })

  it('rejects illegal jumps (proposed → completed)', () => {
    expect(canTransition('proposed', 'completed')).toBe(false)
  })
})

// ── listAppointments ──────────────────────────────────────────────────────────

describe('listAppointments', () => {
  it('returns every appointment newest-first, without scope filtering', async () => {
    const rows = [makeAppointment({ id: 'a' }), makeAppointment({ id: 'b', line: 'NE4', operator_id: 'op-gfp' })]
    const { chain, eqCalls } = buildChain(rows)
    mockFrom.mockReturnValue(chain)

    const { data, error } = await listAppointments()
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
    // No line/operator .eq() filter — schedulers share all appointments.
    expect(eqCalls).toHaveLength(0)
  })
})

// ── createAppointment ─────────────────────────────────────────────────────────

describe('createAppointment', () => {
  it('inserts a proposed appointment stamped with the chosen line/operator + user', async () => {
    const { chain, getPayload } = buildChain([])
    mockFrom.mockReturnValue(chain)

    const { data, error } = await createAppointment(
      { line: 'NE4', operator_id: 'op-gfp', scheduled_at: '2026-05-10T10:00:00.000Z', contact_name: 'Klaus' },
      'sched-1',
    )
    expect(error).toBeNull()
    expect(data?.id).toBe('new-id')
    const payload = getPayload()!
    expect(payload.line).toBe('NE4')
    expect(payload.operator_id).toBe('op-gfp')
    expect(payload.status).toBe('proposed')
    expect(payload.created_by).toBe('sched-1')
    expect(payload.assigned_to).toBe('sched-1')
  })

  it('rejects creation without a scheduled time', async () => {
    const { data, error } = await createAppointment(
      { line: 'NE3', operator_id: 'op-dgf', scheduled_at: '' },
      'sched-1',
    )
    expect(data).toBeNull()
    expect(error).toBeTruthy()
  })

  it('rejects creation without a line or operator', async () => {
    const { data, error } = await createAppointment(
      { line: '' as never, operator_id: '', scheduled_at: '2026-05-10T10:00:00.000Z' },
      'sched-1',
    )
    expect(data).toBeNull()
    expect(error).toBeTruthy()
  })
})

// ── Transition wrappers ───────────────────────────────────────────────────────

describe('transition wrappers', () => {
  it('confirm: proposed → confirmed updates status', async () => {
    const { chain, getPayload } = buildChain([])
    mockFrom.mockReturnValue(chain)
    const { error } = await confirmAppointment(makeAppointment({ status: 'proposed' }))
    expect(error).toBeNull()
    expect(getPayload()!.status).toBe('confirmed')
  })

  it('complete: confirmed → completed updates status', async () => {
    const { chain, getPayload } = buildChain([])
    mockFrom.mockReturnValue(chain)
    const { error } = await completeAppointment(makeAppointment({ status: 'confirmed' }))
    expect(error).toBeNull()
    expect(getPayload()!.status).toBe('completed')
  })

  it('complete is rejected from proposed (illegal jump) without touching supabase', async () => {
    const { error } = await completeAppointment(makeAppointment({ status: 'proposed' }))
    expect(error).toBeTruthy()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('cancel from confirmed sets status and reason', async () => {
    const { chain, getPayload } = buildChain([])
    mockFrom.mockReturnValue(chain)
    const { error } = await cancelAppointment(makeAppointment({ status: 'confirmed' }), 'client no-show')
    expect(error).toBeNull()
    expect(getPayload()!.status).toBe('cancelled')
    expect(getPayload()!.notes).toBe('client no-show')
  })

  it('reschedule updates scheduled_at and status', async () => {
    const { chain, getPayload } = buildChain([])
    mockFrom.mockReturnValue(chain)
    const next = '2026-06-01T09:00:00.000Z'
    const { error } = await rescheduleAppointment(makeAppointment({ status: 'confirmed' }), next)
    expect(error).toBeNull()
    expect(getPayload()!.status).toBe('rescheduled')
    expect(getPayload()!.scheduled_at).toBe(next)
  })

  it('reschedule is rejected from a completed appointment', async () => {
    const { error } = await rescheduleAppointment(
      makeAppointment({ status: 'completed' }),
      '2026-06-01T09:00:00.000Z',
    )
    expect(error).toBeTruthy()
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
