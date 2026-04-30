import { describe, it, expect, vi } from 'vitest'

// Prevent supabase.ts from throwing due to missing env vars
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
import {
  validateStatusTransition,
  VALID_TRANSITIONS,
} from '@/services/workOrderService'
import type { WorkOrderStatus } from '@/types/enums'

// ── VALID_TRANSITIONS coverage ──────────────────────────────────────────────

describe('VALID_TRANSITIONS — terminal states', () => {
  it('paid has no forward transitions', () => {
    expect(VALID_TRANSITIONS['paid']).toHaveLength(0)
  })

  it('cancelled has no forward transitions', () => {
    expect(VALID_TRANSITIONS['cancelled']).toHaveLength(0)
  })
})

describe('VALID_TRANSITIONS — happy path (full pipeline)', () => {
  const pipeline: WorkOrderStatus[] = [
    'created',
    'assigned',
    'in_progress',
    'executed',
    'rueckmeldung_pending',
    'rueckmeldung_sent',
    'internally_certified',
    'sent_to_client',
    'client_accepted',
    'invoiced',
    'paid',
  ]

  for (let i = 0; i < pipeline.length - 1; i++) {
    const from = pipeline[i]
    const to = pipeline[i + 1]
    it(`${from} → ${to} is listed`, () => {
      expect(VALID_TRANSITIONS[from]).toContain(to)
    })
  }
})

// ── validateStatusTransition ────────────────────────────────────────────────

describe('validateStatusTransition — valid transitions', () => {
  it('returns null for created → assigned', () => {
    expect(validateStatusTransition('created', 'assigned')).toBeNull()
  })

  it('returns null for rueckmeldung_sent → internally_certified (admin)', () => {
    expect(
      validateStatusTransition('rueckmeldung_sent', 'internally_certified', 'admin'),
    ).toBeNull()
  })

  it('returns null for client_rejected → internally_certified (admin)', () => {
    expect(
      validateStatusTransition('client_rejected', 'internally_certified', 'admin'),
    ).toBeNull()
  })

  it('returns null for returned → rueckmeldung_pending', () => {
    expect(validateStatusTransition('returned', 'rueckmeldung_pending')).toBeNull()
  })
})

describe('validateStatusTransition — illegal transitions', () => {
  it('rejects created → paid (skips states)', () => {
    expect(validateStatusTransition('created', 'paid')).not.toBeNull()
  })

  it('rejects paid → created (backwards)', () => {
    expect(validateStatusTransition('paid', 'created')).not.toBeNull()
  })

  it('rejects assigned → internally_certified (skips states)', () => {
    expect(validateStatusTransition('assigned', 'internally_certified')).not.toBeNull()
  })

  it('rejects sent_to_client → invoiced (skips client_accepted)', () => {
    expect(validateStatusTransition('sent_to_client', 'invoiced')).not.toBeNull()
  })
})

describe('validateStatusTransition — role-based access', () => {
  it('blocks technician from setting internally_certified', () => {
    const result = validateStatusTransition(
      'rueckmeldung_sent',
      'internally_certified',
      'technician',
    )
    expect(result).not.toBeNull()
    expect(result).toMatch(/Berechtigung/i)
  })

  it('blocks technician from cancelling', () => {
    const result = validateStatusTransition('assigned', 'cancelled', 'technician')
    expect(result).not.toBeNull()
  })

  it('blocks contractor from setting invoiced', () => {
    const result = validateStatusTransition('client_accepted', 'invoiced', 'contractor')
    expect(result).not.toBeNull()
  })

  it('allows technician to move assigned → in_progress', () => {
    expect(
      validateStatusTransition('assigned', 'in_progress', 'technician'),
    ).toBeNull()
  })

  it('allows technician to move in_progress → executed', () => {
    expect(
      validateStatusTransition('in_progress', 'executed', 'technician'),
    ).toBeNull()
  })

  it('allows technician to move executed → rueckmeldung_pending', () => {
    expect(
      validateStatusTransition('executed', 'rueckmeldung_pending', 'technician'),
    ).toBeNull()
  })

  it('allows technician to move rueckmeldung_pending → rueckmeldung_sent', () => {
    expect(
      validateStatusTransition('rueckmeldung_pending', 'rueckmeldung_sent', 'technician'),
    ).toBeNull()
  })

  it('admin can cancel from any non-terminal state', () => {
    const cancellable: WorkOrderStatus[] = [
      'created', 'assigned', 'in_progress', 'executed',
      'rueckmeldung_pending', 'rueckmeldung_sent', 'internally_certified',
    ]
    for (const from of cancellable) {
      expect(validateStatusTransition(from, 'cancelled', 'admin')).toBeNull()
    }
  })
})

// ── Direct-order shortcut (Migration 004) ───────────────────────────────────

describe('validateStatusTransition — direct-order shortcut', () => {
  it('allows internally_certified → invoiced when isDirectOrder=true', () => {
    expect(
      validateStatusTransition('internally_certified', 'invoiced', 'admin', true),
    ).toBeNull()
  })

  it('rejects internally_certified → invoiced when isDirectOrder=false', () => {
    expect(
      validateStatusTransition('internally_certified', 'invoiced', 'admin', false),
    ).not.toBeNull()
  })

  it('rejects internally_certified → invoiced when isDirectOrder is undefined (default)', () => {
    expect(
      validateStatusTransition('internally_certified', 'invoiced', 'admin'),
    ).not.toBeNull()
  })

  it('blocks technician from the direct-order shortcut even with isDirectOrder=true', () => {
    const err = validateStatusTransition(
      'internally_certified', 'invoiced', 'technician', true,
    )
    expect(err).not.toBeNull()
    expect(err).toMatch(/Berechtigung/i)
  })

  it('blocks contractor from the direct-order shortcut', () => {
    expect(
      validateStatusTransition('internally_certified', 'invoiced', 'contractor', true),
    ).not.toBeNull()
  })

  it('isDirectOrder=true does not unlock unrelated illegal transitions', () => {
    expect(
      validateStatusTransition('created', 'invoiced', 'admin', true),
    ).not.toBeNull()
    expect(
      validateStatusTransition('rueckmeldung_sent', 'invoiced', 'admin', true),
    ).not.toBeNull()
    expect(
      validateStatusTransition('sent_to_client', 'paid', 'admin', true),
    ).not.toBeNull()
  })

  it('preserves the standard with-client path even when isDirectOrder=true', () => {
    // A direct-order flag should not prevent the normal admin flow if the
    // admin chooses to send to client anyway (operational override).
    expect(
      validateStatusTransition('internally_certified', 'sent_to_client', 'admin', true),
    ).toBeNull()
  })
})
