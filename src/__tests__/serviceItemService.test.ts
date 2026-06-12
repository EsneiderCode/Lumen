import { describe, expect, it, vi } from 'vitest'
import { groupServiceItemsByCategory } from '@/services/serviceItemService'
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
