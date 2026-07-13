import { describe, expect, it } from 'vitest'

/**
 * Pure key contract tests (mirrors financeOutboxService + FinControl lumenContract).
 * Avoid importing supabase-backed modules here.
 */
function cxcKey(workOrderId: string): string {
  return `lumen:cxc:wo-${workOrderId}`
}
function cxpKey(cycleId: string): string {
  return `lumen:cxp:cycle-${cycleId}`
}

describe('finance outbox idempotency keys', () => {
  it('are stable and unique per domain entity', () => {
    expect(cxcKey('abc')).toBe('lumen:cxc:wo-abc')
    expect(cxpKey('uuid-xyz')).toBe('lumen:cxp:cycle-uuid-xyz')
  })
})
