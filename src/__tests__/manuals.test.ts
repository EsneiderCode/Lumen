import { describe, expect, it } from 'vitest'
import { manualHrefForRole } from '@/config/manuals'

describe('manualHrefForRole', () => {
  it('returns the admin manual for the admin role (any language)', () => {
    expect(manualHrefForRole('admin', 'de')).toBe('/manuals/manual-administrador-es.pdf')
    expect(manualHrefForRole('admin', 'es')).toBe('/manuals/manual-administrador-es.pdf')
  })

  it('returns the internal manual for the technician role (any language)', () => {
    expect(manualHrefForRole('technician', 'de')).toBe('/manuals/manual-interno-es.pdf')
    expect(manualHrefForRole('technician', 'es')).toBe('/manuals/manual-interno-es.pdf')
  })

  it('returns the German contractor manual when language is de', () => {
    expect(manualHrefForRole('contractor', 'de')).toBe('/manuals/handbuch-extern-de.pdf')
  })

  it('returns the Spanish contractor manual when language is es', () => {
    expect(manualHrefForRole('contractor', 'es')).toBe('/manuals/manual-externo-es.pdf')
  })

  it('returns the Spanish contractor manual for any non-de language', () => {
    expect(manualHrefForRole('contractor', 'en')).toBe('/manuals/manual-externo-es.pdf')
    expect(manualHrefForRole('contractor', 'fr')).toBe('/manuals/manual-externo-es.pdf')
  })
})
