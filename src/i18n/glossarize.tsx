import { Fragment, type ReactNode } from 'react'
import { GLOSSARY } from './glossary'
import { T } from '@/components/T'

const KEYS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length)

function escapeRegExp(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

// Whole-word match against unicode letters incl. ÄÖÜß.
const TERM_PATTERN = KEYS.length
  ? new RegExp(
      `(?<![A-Za-zÄÖÜäöüß0-9])(${KEYS.map(escapeRegExp).join('|')})(?![A-Za-zÄÖÜäöüß0-9])`,
      'g',
    )
  : null

/**
 * Splits a German string into a JSX fragment, wrapping any glossary term
 * in <T>. Non-matching segments stay as plain strings.
 *
 *   glossarize('Aufträge für die Rückmeldung')
 *   // → <><T de="Aufträge" /> für die <T de="Rückmeldung" /></>
 *
 * Returns the input string unchanged if no terms match — no extra spans,
 * no React keys, no overhead.
 */
// Colocated with its <G> component on purpose: glossarize depends on <T>, so
// moving <G> into T.tsx would create a circular import. The only cost is that
// Fast Refresh can't hot-reload this module — acceptable for a leaf helper.
// eslint-disable-next-line react-refresh/only-export-components
export function glossarize(text: string | null | undefined): ReactNode {
  if (!text || !TERM_PATTERN) return text ?? ''
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  TERM_PATTERN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TERM_PATTERN.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(<T key={`g-${i++}-${m.index}`} de={m[1]} />)
    last = m.index + m[1].length
  }
  if (!out.length) return text
  if (last < text.length) out.push(text.slice(last))
  return <Fragment>{out}</Fragment>
}

/**
 * Shorthand component for use inside JSX:
 *
 *   <G>{t('admin.orders.title')}</G>
 *
 * Equivalent to {glossarize(t('admin.orders.title'))} but reads tighter
 * in dense templates.
 */
export function G({ children }: { children: string | null | undefined }) {
  return <>{glossarize(children)}</>
}
