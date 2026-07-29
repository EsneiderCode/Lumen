import { describe, expect, it, vi } from 'vitest'
import {
  filterServiceItemsByClient,
  groupServiceItemsByCategory,
  resolveEffectiveCatalogClient,
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

describe('filterServiceItemsByClient', () => {
  const CLIENT_FNS = 'client-fns'
  const CLIENT_INSYTE = 'client-insyte'
  const items = [
    makeItem({ id: 'generic', code: 'GEN-1', client_id: null }),
    makeItem({ id: 'fns', code: '10030300', client_id: CLIENT_FNS }),
    makeItem({ id: 'insyte', code: 'SOP-M', client_id: CLIENT_INSYTE }),
  ]

  it('shows generic + own-client items for an order with a client', () => {
    expect(filterServiceItemsByClient(items, CLIENT_FNS).map((i) => i.id)).toEqual([
      'generic',
      'fns',
    ])
  })

  it('never leaks another client\u2019s items', () => {
    const visible = filterServiceItemsByClient(items, CLIENT_INSYTE)
    expect(visible.map((i) => i.id)).toEqual(['generic', 'insyte'])
  })

  it('shows only generic items when the order has no client (direct order, none chosen yet)', () => {
    expect(filterServiceItemsByClient(items, null).map((i) => i.id)).toEqual(['generic'])
  })

  it('direct order with a chosen catalog client sees generic + that client\u2019s items', () => {
    // Direct orders persist client_id NULL, but the form may choose a client
    // purely to unlock its catalog — same filter semantics as a client order.
    const visible = filterServiceItemsByClient(items, CLIENT_FNS)
    expect(visible.map((i) => i.id)).toEqual(['generic', 'fns'])
    expect(visible.map((i) => i.id)).not.toContain('insyte')
  })

  it('direct order switching catalog client swaps the scoped items', () => {
    expect(filterServiceItemsByClient(items, CLIENT_INSYTE).map((i) => i.id)).toEqual([
      'generic',
      'insyte',
    ])
  })

  it('keeps the currently selected item visible even if it no longer matches', () => {
    const visible = filterServiceItemsByClient(items, CLIENT_FNS, 'insyte')
    expect(visible.map((i) => i.id)).toEqual(['generic', 'fns', 'insyte'])
  })

  it('ignores an empty keepItemId', () => {
    expect(filterServiceItemsByClient(items, null, '').map((i) => i.id)).toEqual(['generic'])
  })
})

describe('resolveEffectiveCatalogClient', () => {
  const CLIENT_FNS = 'client-fns'
  const CLIENT_INSYTE = 'client-insyte'

  it('normal order: catalog follows the order client', () => {
    expect(resolveEffectiveCatalogClient(false, CLIENT_FNS, null)).toBe(CLIENT_FNS)
  })

  it('normal order without client yet: generic-only catalog', () => {
    expect(resolveEffectiveCatalogClient(false, null, null)).toBeNull()
    expect(resolveEffectiveCatalogClient(false, '', null)).toBeNull()
  })

  it('direct order: uses only the explicit catalog client', () => {
    expect(resolveEffectiveCatalogClient(true, null, CLIENT_INSYTE)).toBe(CLIENT_INSYTE)
  })

  it('direct order without a chosen catalog client: no filter client', () => {
    expect(resolveEffectiveCatalogClient(true, null, null)).toBeNull()
  })

  it('no project→direct leakage: project-derived client is ignored on direct orders', () => {
    // Bug scenario: a project set form.client_id = FNS, then the admin
    // toggled direct order on. The FNS client must NOT filter the catalog.
    expect(resolveEffectiveCatalogClient(true, CLIENT_FNS, null)).toBeNull()
  })

  it('direct order with explicit catalog client filters the catalog to that client', () => {
    const items = [
      makeItem({ id: 'generic', code: 'GEN-1', client_id: null }),
      makeItem({ id: 'fns', code: '10030300', client_id: CLIENT_FNS }),
      makeItem({ id: 'insyte', code: 'SOP-M', client_id: CLIENT_INSYTE }),
    ]
    // Even with a leftover project-derived order client (FNS), the direct
    // catalog is scoped by the explicit catalog client (Insyte) only.
    const effective = resolveEffectiveCatalogClient(true, CLIENT_FNS, CLIENT_INSYTE)
    expect(filterServiceItemsByClient(items, effective).map((i) => i.id)).toEqual([
      'generic',
      'insyte',
    ])
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
    // Even if the form still carries a project-derived client, a direct
    // order must persist NULL — that is what defines it in the DB.
    expect(resolvePersistedClientId(true, CLIENT_FNS)).toBeNull()
  })
})
