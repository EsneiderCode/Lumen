/**
 * Shared project code dictionary (Lumen ↔ FinControl).
 *
 * Canonical form = Lumen `projects.code` (uppercase short code).
 * FinControl historically used labels like `PROY-004 (NE4)` — normalize both sides
 * through this map until the masters are unified.
 *
 * Keep in sync with: fincontrol/src/finance/projectCodeAliases.js
 */

/** Alias or legacy code → canonical Lumen code */
export const PROJECT_CODE_ALIASES: Record<string, string> = {
  // FinControl legacy PROY-* → operational codes (edit as you unify)
  'PROY-001': 'QFF',
  'PROY-002': 'QDU',
  'PROY-003': 'FBX',
  'PROY-004': 'NE4',
  'PROY-005': 'AUSTRIA',
  // Identity (canonical = self)
  QFF: 'QFF',
  QDU: 'QDU',
  FBX: 'FBX',
  NE4: 'NE4',
  HXT: 'HXT',
  RSD: 'RSD',
  WCB: 'WCB',
  WRZ: 'WRZ',
  EHR: 'EHR',
  AUSTRIA: 'AUSTRIA',
  GFP: 'GFP',
  UGG: 'UGG',
  DGF: 'DGF',
}

/** Strip "(…)" suffixes and whitespace: "PROY-004 (NE4)" → "PROY-004" / "NE4" attempts */
export function extractProjectToken(raw: string): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  const paren = s.match(/\(([^)]+)\)/)
  if (paren?.[1]) {
    const inner = paren[1].trim().toUpperCase()
    if (PROJECT_CODE_ALIASES[inner] || inner.length <= 8) return PROJECT_CODE_ALIASES[inner] ?? inner
  }
  const head = s.split(/[\s(/]/)[0]?.trim() ?? s
  return head.toUpperCase()
}

export function canonicalizeProjectCode(raw: string | null | undefined): string {
  if (!raw) return ''
  const token = extractProjectToken(raw)
  if (!token) return ''
  return PROJECT_CODE_ALIASES[token] ?? token
}

/** True if two project labels refer to the same canonical project. */
export function projectCodesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = canonicalizeProjectCode(a)
  const cb = canonicalizeProjectCode(b)
  if (!ca || !cb) return false
  return ca === cb
}
