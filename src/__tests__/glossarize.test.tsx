import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, it, expect } from 'vitest'
import { glossarize, G } from '@/i18n/glossarize'
import { T } from '@/components/T'

/**
 * Flattens glossarize() output into the reconstructed visible text plus the
 * list of German terms that got wrapped in <T>. Decoupled from <T>'s DOM —
 * we assert on the structure glossarize() produces, not on Lernmodus markup.
 */
function inspect(node: ReactNode): { text: string; terms: string[] } {
  if (typeof node === 'string') return { text: node, terms: [] }
  const children = (node as ReactElement<{ children: ReactNode }>).props.children
  const arr = Array.isArray(children) ? children : [children]
  let text = ''
  const terms: string[] = []
  for (const child of arr) {
    if (typeof child === 'string') {
      text += child
    } else if (isValidElement(child) && child.type === T) {
      const de = (child.props as { de: string }).de
      text += de
      terms.push(de)
    }
  }
  return { text, terms }
}

describe('glossarize()', () => {
  it('returns an empty string for nullish or empty input', () => {
    expect(glossarize(null)).toBe('')
    expect(glossarize(undefined)).toBe('')
    expect(glossarize('')).toBe('')
  })

  it('returns the original string unchanged when no term matches', () => {
    expect(glossarize('hello world')).toBe('hello world')
    expect(glossarize('für die heute')).toBe('für die heute')
  })

  it('wraps a single known term while preserving surrounding text', () => {
    const { text, terms } = inspect(glossarize('für die Zugewiesen'))
    expect(terms).toEqual(['Zugewiesen'])
    expect(text).toBe('für die Zugewiesen')
  })

  it('wraps every known term in a multi-term string', () => {
    const { text, terms } = inspect(glossarize('Aufträge für die Rückmeldung'))
    expect(terms).toEqual(['Aufträge', 'Rückmeldung'])
    expect(text).toBe('Aufträge für die Rückmeldung')
  })

  it('respects whole-word boundaries — no match inside a longer word', () => {
    // "Aufträgen" contains "Aufträge" but the trailing "n" breaks the boundary.
    expect(glossarize('Aufträgen')).toBe('Aufträgen')
  })

  it('matches a hyphenated compound key as a single unit', () => {
    // "Service-Katalog" is its own glossary key; longest-match wins over "Katalog".
    const { terms } = inspect(glossarize('Service-Katalog'))
    expect(terms).toEqual(['Service-Katalog'])
  })

  it('prefers the longest term (plural over singular)', () => {
    // "Rückmeldungen" must match the plural key as one unit, not "Rückmeldung" + "en".
    const { text, terms } = inspect(glossarize('Rückmeldungen'))
    expect(terms).toEqual(['Rückmeldungen'])
    expect(text).toBe('Rückmeldungen')
  })
})

describe('<G>', () => {
  // G is a thin wrapper: <>{glossarize(children)}</>. Invoke it directly and
  // unwrap the Fragment so we can reuse the same structural assertions.
  function renderG(children: string | null | undefined): ReactNode {
    const fragment = G({ children }) as ReactElement<{ children: ReactNode }>
    return fragment.props.children
  }

  it('delegates to glossarize and wraps known terms', () => {
    expect(inspect(renderG('Projekte')).terms).toEqual(['Projekte'])
  })

  it('produces an empty string for nullish children', () => {
    expect(renderG(null)).toBe('')
  })
})
