import { beforeEach, describe, expect, it, vi } from 'vitest'

// La referencia de obra tiene que verse sin credenciales (CLAUDE.md: una
// función que toca Supabase se demuestra en modo demo). Este test recorre el
// mismo camino que la lista de órdenes: fetch → columnas nuevas → etiqueta.
vi.mock('@/lib/supabase', async () => {
  const { createDemoSupabaseClient } = await import('@/lib/demo/supabase-mock')
  return { supabase: createDemoSupabaseClient(), isDemoSupabase: true }
})

const { supabase } = await import('@/lib/supabase')
import { resetStore } from '@/lib/demo/store'
import { fetchWorkOrders } from '@/services/workOrderService'
import { orderSiteRef, orderTypeLabel } from '@/lib/orderSiteRef'

beforeEach(() => {
  resetStore()
})

describe('la referencia de obra en modo demo', () => {
  it('llega desde el store hasta la etiqueta de la lista', async () => {
    const { data } = await fetchWorkOrders({}, 0, 50)
    const sopladoRa = data.find((o) => o.capture_plan_key === 'soplado_ra')

    expect(sopladoRa, 'la orden de soplado de RA sigue en las fixtures').toBeDefined()
    // Sin esto la fila diría solo «Soplado», que es el problema de partida.
    expect(orderSiteRef(sopladoRa!)).toBe('HXT001-DP021')
    expect(orderTypeLabel(sopladoRa!, 'Soplado', (k) => k.toUpperCase())).toBe('Soplado RA')
  })

  it('las órdenes sin tramo no inventan una referencia', async () => {
    const { data } = await fetchWorkOrders({}, 0, 50)
    const sinTramo = data.filter((o) => o.capture_plan_key !== 'soplado_ra')

    expect(sinTramo.length).toBeGreaterThan(0)
    for (const order of sinTramo) {
      expect(orderSiteRef(order), order.order_number).toBeNull()
    }
  })

  // POP y DP se guardan sin el prefijo del proyecto ni el 'DP', así que buscar
  // la etiqueta tal como se lee en pantalla tiene que seguir encontrándola.
  it.each(['HXT001-DP021', '001', 'DP021'])('encuentra la orden buscando «%s»', async (term) => {
    const { data } = await fetchWorkOrders({ search: term }, 0, 50)
    expect(data.map((o) => o.order_number)).toContain('LUM-20260428-0010')
  })

  it('el CHECK de la migración 064 admite el valor que siembra la demo', async () => {
    const { data } = await supabase.from('work_orders').select('*').eq('segment_kind', 'ra')
    expect((data ?? []).length).toBe(1)
  })
})
