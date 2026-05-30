import { describe, it, expect } from 'vitest'
import de from '@/i18n/locales/de.json'
import es from '@/i18n/locales/es.json'

// Helper: retrieve a nested value by dot-path (e.g. "auth.pin.savePIN")
function getKey(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, obj)
}

// Keys that TechSettingsPage.tsx references under auth.pin.*
const AUTH_PIN_KEYS = [
  'auth.pin.enter6Digits',
  'auth.pin.settingsTitle',
  'auth.pin.enterCurrent',
  'auth.pin.enterNew',
  'auth.pin.reenterNew',
  'auth.pin.savePIN',
  'auth.pin.mismatch',
  'auth.pin.changeSuccess',
]

// Breadcrumb keys added for /admin/projects
const BREADCRUMB_KEYS = ['breadcrumb.projects']

const REQUIRED_KEYS = [...AUTH_PIN_KEYS, ...BREADCRUMB_KEYS]

describe('i18n locale key parity — de.json and es.json', () => {
  for (const key of REQUIRED_KEYS) {
    it(`de.json has "${key}" with a non-empty string value`, () => {
      const value = getKey(de as Record<string, unknown>, key)
      expect(typeof value).toBe('string')
      expect((value as string).length).toBeGreaterThan(0)
    })

    it(`es.json has "${key}" with a non-empty string value`, () => {
      const value = getKey(es as Record<string, unknown>, key)
      expect(typeof value).toBe('string')
      expect((value as string).length).toBeGreaterThan(0)
    })
  }

  it('de.json and es.json have the same auth.pin keys', () => {
    const dePin = (de as Record<string, unknown>).auth as Record<string, Record<string, unknown>>
    const esPin = (es as Record<string, unknown>).auth as Record<string, Record<string, unknown>>
    expect(Object.keys(dePin.pin).sort()).toEqual(Object.keys(esPin.pin).sort())
  })

  it('de.json and es.json have the same breadcrumb keys', () => {
    const deBc = (de as Record<string, unknown>).breadcrumb as Record<string, unknown>
    const esBc = (es as Record<string, unknown>).breadcrumb as Record<string, unknown>
    expect(Object.keys(deBc).sort()).toEqual(Object.keys(esBc).sort())
  })
})
