/// <reference types="node" />

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isSegmentKind,
  normalizeSiteCode,
  orderSiteRef,
  orderTypeLabel,
  SEGMENT_KINDS,
} from '@/lib/orderSiteRef'

const segment = (kind: 'ra' | 'rd') => kind.toUpperCase()

describe('normalizeSiteCode', () => {
  it('rellena a tres dígitos los códigos numéricos', () => {
    // Sin esto «1» y «001» serían dos POPs distintos para el buscador.
    expect(normalizeSiteCode('1')).toBe('001')
    expect(normalizeSiteCode('21')).toBe('021')
    expect(normalizeSiteCode('001')).toBe('001')
  })

  it('no toca los códigos de más de tres dígitos', () => {
    expect(normalizeSiteCode('1042')).toBe('1042')
  })

  it('respeta los códigos con letras, solo en mayúsculas', () => {
    expect(normalizeSiteCode('a12')).toBe('A12')
    expect(normalizeSiteCode(' 021b ')).toBe('021B')
  })

  it('trata el vacío y el blanco como ausencia', () => {
    expect(normalizeSiteCode('')).toBeNull()
    expect(normalizeSiteCode('   ')).toBeNull()
    expect(normalizeSiteCode(null)).toBeNull()
    expect(normalizeSiteCode(undefined)).toBeNull()
  })
})

describe('orderSiteRef', () => {
  const project = { code: 'QFF' }

  it('compone la etiqueta del ejemplo real', () => {
    expect(orderSiteRef({ pop_code: '001', dp_code: '021', projects: project })).toBe(
      'QFF001-DP021',
    )
  })

  it('normaliza al componer, no solo al guardar', () => {
    // Órdenes anteriores a la normalización, o cargadas por API, siguen leyéndose bien.
    expect(orderSiteRef({ pop_code: '1', dp_code: '21', projects: project })).toBe('QFF001-DP021')
  })

  it('con solo POP omite el sufijo DP', () => {
    expect(orderSiteRef({ pop_code: '001', dp_code: null, projects: project })).toBe('QFF001')
  })

  it('con solo DP conserva el proyecto: un DP suelto no significa nada', () => {
    expect(orderSiteRef({ pop_code: null, dp_code: '021', projects: project })).toBe('QFF-DP021')
  })

  it('sin POP ni DP no hay referencia', () => {
    expect(orderSiteRef({ pop_code: null, dp_code: null, projects: project })).toBeNull()
    expect(orderSiteRef({ projects: project })).toBeNull()
  })

  it('sobrevive a una orden sin proyecto cargado', () => {
    expect(orderSiteRef({ pop_code: '001', dp_code: '021', projects: null })).toBe('001-DP021')
  })
})

describe('orderTypeLabel', () => {
  it('añade el tramo al tipo — que es lo que hoy hay que adivinar', () => {
    expect(orderTypeLabel({ segment_kind: 'ra' }, 'Soplado', segment)).toBe('Soplado RA')
    expect(orderTypeLabel({ segment_kind: 'rd' }, 'Soplado', segment)).toBe('Soplado RD')
  })

  it('deja el tipo intacto cuando no hay tramo', () => {
    expect(orderTypeLabel({ segment_kind: null }, 'Alta', segment)).toBe('Alta')
    expect(orderTypeLabel({}, 'Alta', segment)).toBe('Alta')
  })

  it('ignora un tramo que no reconoce en vez de pintarlo crudo', () => {
    expect(orderTypeLabel({ segment_kind: 'xx' }, 'Soplado', segment)).toBe('Soplado')
  })
})

describe('isSegmentKind', () => {
  it('acepta solo los tramos del CHECK de la migración 064', () => {
    expect(SEGMENT_KINDS).toEqual(['ra', 'rd'])
    expect(isSegmentKind('ra')).toBe(true)
    expect(isSegmentKind('RA')).toBe(false)
    expect(isSegmentKind(null)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// La Edge Function de Telegram corre en Deno y no puede importar este módulo,
// así que lleva una copia manual. Si las dos se separan, el grupo de Telegram y
// la pantalla del técnico dejan de nombrar igual la misma orden — que es
// exactamente el problema que la referencia venía a resolver.
// ─────────────────────────────────────────────────────────────────────────────
describe('la copia de la Edge Function no se ha separado del original', () => {
  const efSource = readFileSync(
    join(process.cwd(), 'supabase', 'functions', 'send-telegram', 'index.ts'),
    'utf8',
  )

  it('normaliza los códigos con la misma regla', () => {
    expect(efSource).toContain("return /^\\d+$/.test(trimmed) ? trimmed.padStart(3, '0') : trimmed")
  })

  it('compone la etiqueta con la misma regla', () => {
    expect(efSource).toContain("[`${project}${pop ?? ''}`, dp ? `DP${dp}` : ''].filter(Boolean).join('-')")
  })

  it('conoce los mismos tramos', () => {
    for (const kind of SEGMENT_KINDS) {
      expect(efSource).toMatch(new RegExp(`^\\s*${kind}: '${kind.toUpperCase()}',`, 'm'))
    }
  })

  it('lee de la base las tres columnas, o la tarjeta las daría siempre por vacías', () => {
    expect(efSource).toContain('work_type,segment_kind,pop_code,dp_code,status')
  })
})
