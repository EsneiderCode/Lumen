import { describe, expect, it, vi } from 'vitest'
import {
  applicableServiceItems,
  groupServiceItemsByCategory,
  resolvePersistedClientId,
} from '@/services/serviceItemService'
import type { ServiceItem } from '@/types/service-items'

// groupServiceItemsByCategory is a pure function, but the module imports
// supabase at the top level, which requires env vars. Mock the client.
vi.mock('@/lib/supabase', () => {
  const chain = () => {
    const obj: Record<string, unknown> = {}
    const methods = ['from', 'select', 'insert', 'update', 'delete', 'eq', 'order', 'single']
    for (const m of methods) obj[m] = vi.fn(() => obj)
    return obj
  }
  return { supabase: chain() }
})

function makeItem(overrides: Partial<ServiceItem> & { id: string; code: string }): ServiceItem {
  return {
    description_de: 'Test item',
    description_es: null,
    unit: null,
    unit_price: null,
    unit_price_external: null,
    category: null,
    operator_id: null,
    client_id: null,
    detail_form: null,
    display_order: 0,
    active: true,
    is_pass_through: false,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('groupServiceItemsByCategory', () => {
  it('returns empty array for empty input', () => {
    expect(groupServiceItemsByCategory([])).toEqual([])
  })

  it('groups items by category in first-occurrence order', () => {
    const items = [
      makeItem({ id: '1', code: 'A', category: 'Cat B', display_order: 10 }),
      makeItem({ id: '2', code: 'B', category: 'Cat A', display_order: 20 }),
      makeItem({ id: '3', code: 'C', category: 'Cat B', display_order: 30 }),
      makeItem({ id: '4', code: 'D', category: 'Cat A', display_order: 40 }),
    ]
    const groups = groupServiceItemsByCategory(items)
    expect(groups).toHaveLength(2)
    // First occurrence is 'Cat B' (item id='1'), then 'Cat A'
    expect(groups[0].category).toBe('Cat B')
    expect(groups[1].category).toBe('Cat A')
  })

  it('places null-category group last regardless of input order', () => {
    const items = [
      makeItem({ id: '1', code: 'A', category: null }),
      makeItem({ id: '2', code: 'B', category: 'Cat X' }),
      makeItem({ id: '3', code: 'C', category: null }),
    ]
    const groups = groupServiceItemsByCategory(items)
    expect(groups).toHaveLength(2)
    expect(groups[0].category).toBe('Cat X')
    expect(groups[1].category).toBeNull()
  })

  it('preserves item order within each group', () => {
    const items = [
      makeItem({ id: '1', code: 'A1', category: 'Cat A', display_order: 10 }),
      makeItem({ id: '2', code: 'B1', category: 'Cat B', display_order: 20 }),
      makeItem({ id: '3', code: 'A2', category: 'Cat A', display_order: 30 }),
      makeItem({ id: '4', code: 'B2', category: 'Cat B', display_order: 40 }),
    ]
    const groups = groupServiceItemsByCategory(items)
    expect(groups[0].items.map((i) => i.code)).toEqual(['A1', 'A2'])
    expect(groups[1].items.map((i) => i.code)).toEqual(['B1', 'B2'])
  })

  it('returns a single group when all items share the same category', () => {
    const items = [
      makeItem({ id: '1', code: 'X', category: 'Only Cat' }),
      makeItem({ id: '2', code: 'Y', category: 'Only Cat' }),
    ]
    const groups = groupServiceItemsByCategory(items)
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('Only Cat')
    expect(groups[0].items).toHaveLength(2)
  })

  it('returns a single null group when all items have no category', () => {
    const items = [
      makeItem({ id: '1', code: 'X', category: null }),
      makeItem({ id: '2', code: 'Y', category: null }),
    ]
    const groups = groupServiceItemsByCategory(items)
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBeNull()
    expect(groups[0].items).toHaveLength(2)
  })
})


describe('applicableServiceItems', () => {
  const CLIENT_FNS = 'client-fns'
  const CLIENT_INSYTE = 'client-insyte'
  const OP_TELEKOM = 'op-telekom'
  const scope = (over: Partial<Parameters<typeof applicableServiceItems>[1]> = {}) => ({
    clientId: null,
    operatorId: null,
    excludePassThrough: false,
    ...over,
  })

  const items = [
    makeItem({ id: 'generic', code: 'GEN-1' }),
    makeItem({ id: 'fns', code: '10030300', client_id: CLIENT_FNS }),
    makeItem({ id: 'insyte', code: 'SOP-M', client_id: CLIENT_INSYTE }),
    makeItem({
      id: 'fns-le',
      code: '10081334',
      client_id: CLIENT_FNS,
      unit: 'LE',
      unit_price: null,
      is_pass_through: true,
    }),
  ]
  const ids = (list: ServiceItem[]) => list.map((i) => i.id)

  it('offers generic + own-client items', () => {
    expect(ids(applicableServiceItems(items, scope({ clientId: CLIENT_FNS })))).toEqual([
      'generic',
      'fns',
      'fns-le',
    ])
  })

  it('never leaks another client’s items', () => {
    expect(ids(applicableServiceItems(items, scope({ clientId: CLIENT_INSYTE })))).toEqual([
      'generic',
      'insyte',
    ])
  })

  it('offers only generic items when the order has no client (Direktauftrag)', () => {
    expect(ids(applicableServiceItems(items, scope()))).toEqual(['generic'])
  })

  it('filters by operator too, keeping operator-agnostic items', () => {
    const withOperator = [
      ...items,
      makeItem({ id: 'telekom', code: 'TK-1', operator_id: OP_TELEKOM }),
      makeItem({ id: 'other-op', code: 'OT-1', operator_id: 'op-dgf' }),
    ]
    expect(ids(applicableServiceItems(withOperator, scope({ operatorId: OP_TELEKOM })))).toEqual([
      'generic',
      'telekom',
    ])
  })

  it('drops pass-through positions from the field catalog', () => {
    // A technician reporting one would block the internal certification: it
    // carries no unit price, so no billing line can be built from it.
    const visible = applicableServiceItems(
      items,
      scope({ clientId: CLIENT_FNS, excludePassThrough: true }),
    )
    expect(ids(visible)).toEqual(['generic', 'fns'])
  })

  it('keeps pass-through positions for admin screens', () => {
    const visible = applicableServiceItems(items, scope({ clientId: CLIENT_FNS }))
    expect(ids(visible)).toContain('fns-le')
  })

  it('keeps the already-selected item visible even when out of scope', () => {
    const visible = applicableServiceItems(
      items,
      scope({ clientId: CLIENT_FNS, keepItemId: 'insyte' }),
    )
    expect(ids(visible)).toEqual(['generic', 'fns', 'insyte', 'fns-le'])
  })

  it('ignores an empty keepItemId', () => {
    expect(ids(applicableServiceItems(items, scope({ keepItemId: '' })))).toEqual(['generic'])
  })
})

describe('resolvePersistedClientId', () => {
  const CLIENT_FNS = 'client-fns'

  it('normal order persists its client_id', () => {
    expect(resolvePersistedClientId(false, CLIENT_FNS)).toBe(CLIENT_FNS)
  })

  it('normal order with empty client normalizes to null', () => {
    expect(resolvePersistedClientId(false, '')).toBeNull()
  })

  it('direct order always persists client_id null (Direktauftrag = client_id IS NULL)', () => {
    expect(resolvePersistedClientId(true, null)).toBeNull()
    expect(resolvePersistedClientId(true, CLIENT_FNS)).toBeNull()
  })
})
