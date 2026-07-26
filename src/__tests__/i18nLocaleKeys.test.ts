import { describe, it, expect } from 'vitest'
import de from '@/i18n/locales/de.json'
import es from '@/i18n/locales/es.json'
import { SOPLADO_RA_PLAN } from '@/constants/capture-plans-soplado-ra'
import type { CapturePlan } from '@/types/capture-plan'

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

  // The capture-plan form (phase 2 of the Rückmeldung photo flow) is fully
  // driven by these keys — a missing one shows up as a raw key on the
  // technician's screen, in the field, with no admin around.
  it('de.json and es.json have the same capture keys', () => {
    const flatten = (value: unknown, prefix = ''): string[] =>
      value && typeof value === 'object'
        ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
            flatten(child, prefix ? `${prefix}.${key}` : key),
          )
        : [prefix]

    const deCapture = flatten((de as Record<string, unknown>).capture).sort()
    const esCapture = flatten((es as Record<string, unknown>).capture).sort()

    expect(deCapture).toEqual(esCapture)
    expect(deCapture).toContain('slot.missing')
    expect(deCapture).toContain('slot.queued')
    expect(deCapture).toContain('missing.summary')
  })

  // The offline strings are the only feedback a technician gets when nothing
  // else on the screen can talk to the server — a raw key there reads as a bug
  // in the exact moment the app is asking to be trusted with their work.
  it('has every offline string in both locales', () => {
    const deOffline = (de as Record<string, unknown>).offline as Record<string, string>
    const esOffline = (es as Record<string, unknown>).offline as Record<string, string>

    expect(Object.keys(deOffline).sort()).toEqual(Object.keys(esOffline).sort())
    for (const key of [
      'banner',
      'bannerQueued',
      'pending',
      'syncing',
      'syncNow',
      'savedLocally',
      'sendQueued',
      'sendQueuedFailed',
      'photoQueueFailed',
      'cachedView',
      'pendingBlocked',
    ]) {
      expect(deOffline[key]?.length, `de.offline.${key}`).toBeGreaterThan(0)
      expect(esOffline[key]?.length, `es.offline.${key}`).toBeGreaterThan(0)
    }
    // Counted strings interpolate; a hardcoded number would lie.
    for (const key of ['bannerQueued', 'pending', 'syncing']) {
      expect(deOffline[key]).toContain('{{count}}')
      expect(esOffline[key]).toContain('{{count}}')
    }
  })

  // A capture plan is data: every label it shows comes from a key in these two
  // files. A missing one shows up as a raw key on a technician's phone, in the
  // field, on the plan whose whole point is being self-explanatory.
  it('resolves every label the Soplado de RA plan references, in both locales', () => {
    const referencedKeys = (plan: CapturePlan): string[] => {
      const keys: string[] = []
      const collect = (value: string | undefined) => {
        if (value) keys.push(value)
      }
      collect(plan.titleKey)
      for (const section of plan.sections) {
        collect(section.titleKey)
        collect(section.descriptionKey)
        if (section.kind === 'repeater') collect(section.itemLabelKey)
        if ('slots' in section) {
          for (const slot of section.slots) {
            collect(slot.labelKey)
            collect(slot.hintKey)
          }
        }
        if ('fields' in section) {
          for (const field of section.fields) {
            collect(field.labelKey)
            collect(field.placeholderKey)
            // Select options are NOT collected: the stored value stays canonical
            // and `detailOption.*` only overrides the ones that need a different
            // word per language — the rest fall back to the value itself.
          }
        }
      }
      return keys
    }

    for (const key of referencedKeys(SOPLADO_RA_PLAN)) {
      expect(getKey(de as Record<string, unknown>, key), `de: ${key}`).toEqual(expect.any(String))
      expect(getKey(es as Record<string, unknown>, key), `es: ${key}`).toEqual(expect.any(String))
    }
  })

  it('de.json and es.json have the same capturePlan keys', () => {
    const flatten = (value: unknown, prefix = ''): string[] =>
      value && typeof value === 'object'
        ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
            flatten(child, prefix ? `${prefix}.${key}` : key),
          )
        : [prefix]

    expect(flatten((de as Record<string, unknown>).capturePlan).sort()).toEqual(
      flatten((es as Record<string, unknown>).capturePlan).sort(),
    )
  })

  it('de.json and es.json have the same breadcrumb keys', () => {
    const deBc = (de as Record<string, unknown>).breadcrumb as Record<string, unknown>
    const esBc = (es as Record<string, unknown>).breadcrumb as Record<string, unknown>
    expect(Object.keys(deBc).sort()).toEqual(Object.keys(esBc).sort())
  })
})
