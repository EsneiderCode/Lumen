import { describe, expect, it } from 'vitest'
import {
  checklistProgress,
  documentTypeName,
  metadataFieldsFor,
  missingMetadataFields,
  parseAmountToken,
  parseDocumentFields,
  scoreScheinselbst,
  sniffFileKind,
  sortChecklist,
} from '@/services/complianceHelpers'
import type {
  ChecklistItemView,
  DocumentMetadataInput,
  DocumentRequirement,
  DocumentType,
  EntityDocument,
  EntityDocumentStatus,
} from '@/types/compliance'

const docType = (overrides: Partial<DocumentType> = {}): DocumentType => ({
  id: 'dt-1',
  code: 'generic',
  name_i18n: { es: 'Genérico', de: 'Generisch', en: 'Generic' },
  description_i18n: null,
  metadata_schema: [],
  template_storage_path: null,
  is_active: true,
  ...overrides,
})

const requirement = (overrides: Partial<DocumentRequirement> = {}): DocumentRequirement => ({
  id: 'req-1',
  document_type_id: 'dt-1',
  document_type_code: 'generic',
  applies_to: 'company',
  origin: 'ALL',
  scope: 'entity',
  is_mandatory: true,
  conditions: {},
  validity_rule: 'no_expiry',
  validity_days: null,
  min_amount: null,
  requires_coverage_confirmation: false,
  notify_days: [],
  on_missing_action: null,
  is_active: true,
  ...overrides,
})

const item = (status: EntityDocumentStatus, overrides: Partial<EntityDocument> = {}): EntityDocument => ({
  id: `ed-${status}`,
  entity_id: 'ce-1',
  requirement_id: 'req-1',
  document_type_id: 'dt-1',
  project_id: null,
  status,
  current_version_id: null,
  approved_issued_at: null,
  approved_expires_at: null,
  approved_amount: null,
  coverage_confirmed: false,
  ...overrides,
})

const view = (
  status: EntityDocumentStatus,
  overrides: Partial<ChecklistItemView> = {},
): ChecklistItemView => ({
  item: item(status),
  documentType: docType(),
  requirement: requirement(),
  currentVersion: null,
  latestReview: null,
  ...overrides,
})

describe('sniffFileKind — magic-byte detection', () => {
  it('detects PDF from %PDF header', () => {
    expect(sniffFileKind(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe('pdf')
  })

  it('detects JPEG from FF D8 FF', () => {
    expect(sniffFileKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg')
  })

  it('detects PNG from its 8-byte signature', () => {
    expect(sniffFileKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png')
  })

  it('rejects an unknown / spoofed file', () => {
    // A .exe renamed to .pdf still fails the byte check.
    expect(sniffFileKind(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBeNull()
    expect(sniffFileKind(new Uint8Array([]))).toBeNull()
  })
})

describe('metadataFieldsFor — form derivation', () => {
  it('requires expiry for expiry_required rules', () => {
    const fields = metadataFieldsFor(docType(), requirement({ validity_rule: 'expiry_required' }))
    expect(fields).toContainEqual({ key: 'expires_at', required: true })
    expect(fields).toContainEqual({ key: 'issued_at', required: false })
  })

  it('requires issue date for days_from_issue rules', () => {
    const fields = metadataFieldsFor(docType(), requirement({ validity_rule: 'days_from_issue' }))
    expect(fields).toContainEqual({ key: 'issued_at', required: true })
  })

  it('requires both dates for must_cover_assignment (A1)', () => {
    const fields = metadataFieldsFor(docType(), requirement({ validity_rule: 'must_cover_assignment' }))
    expect(fields).toContainEqual({ key: 'issued_at', required: true })
    expect(fields).toContainEqual({ key: 'expires_at', required: true })
  })

  it('adds a required amount field when the rule sets a minimum', () => {
    const fields = metadataFieldsFor(docType(), requirement({ min_amount: 500000 }))
    expect(fields).toContainEqual({ key: 'amount', required: true })
  })

  it('adds an optional amount field from the type metadata schema', () => {
    const fields = metadataFieldsFor(
      docType({ metadata_schema: [{ key: 'amount', type: 'number' }] }),
      requirement({ min_amount: null }),
    )
    expect(fields).toContainEqual({ key: 'amount', required: false })
  })

  it('falls back to optional dates for ad-hoc items (no requirement)', () => {
    const fields = metadataFieldsFor(docType(), null)
    expect(fields).toEqual([
      { key: 'issued_at', required: false },
      { key: 'expires_at', required: false },
    ])
  })
})

describe('missingMetadataFields', () => {
  const base: DocumentMetadataInput = { issued_at: null, expires_at: null, amount: null }

  it('flags missing required fields', () => {
    const fields = metadataFieldsFor(docType(), requirement({ validity_rule: 'expiry_required' }))
    expect(missingMetadataFields(fields, base)).toContain('expires_at')
  })

  it('passes when required fields are present', () => {
    const fields = metadataFieldsFor(docType(), requirement({ validity_rule: 'expiry_required' }))
    expect(missingMetadataFields(fields, { ...base, expires_at: '2027-01-01' })).toEqual([])
  })

  it('rejects an expiry earlier than the issue date', () => {
    const fields = metadataFieldsFor(docType(), requirement({ validity_rule: 'must_cover_assignment' }))
    const values = { ...base, issued_at: '2026-05-01', expires_at: '2026-04-01' }
    expect(missingMetadataFields(fields, values)).toContain('expires_at')
  })
})

describe('documentTypeName', () => {
  it('picks the language, falling back to es → de → en → code', () => {
    const type = docType({ name_i18n: { de: 'Nur DE' } })
    expect(documentTypeName(docType(), 'de-DE')).toBe('Generisch')
    expect(documentTypeName(type, 'es')).toBe('Nur DE')
    expect(documentTypeName(docType({ name_i18n: {} }), 'es')).toBe('generic')
  })
})

describe('sortChecklist', () => {
  it('surfaces action-needed items before valid and inapplicable ones', () => {
    const rows = [
      view('approved'),
      view('rejected'),
      view('not_applicable'),
      view('pending'),
    ]
    const ordered = sortChecklist(rows).map((row) => row.item.status)
    expect(ordered).toEqual(['rejected', 'pending', 'approved', 'not_applicable'])
  })

  it('orders mandatory before optional within the same status', () => {
    const optional = view('pending', {
      item: item('pending', { id: 'opt' }),
      requirement: requirement({ is_mandatory: false }),
    })
    const mandatory = view('pending', {
      item: item('pending', { id: 'mand' }),
      requirement: requirement({ is_mandatory: true }),
    })
    const ordered = sortChecklist([optional, mandatory]).map((row) => row.item.id)
    expect(ordered).toEqual(['mand', 'opt'])
  })
})

describe('checklistProgress', () => {
  it('counts approved/expiring mandatory slots, ignoring not_applicable and optional', () => {
    const rows = [
      view('approved'),
      view('expiring'),
      view('rejected'),
      view('not_applicable'),
      view('pending', { requirement: requirement({ is_mandatory: false }) }),
    ]
    expect(checklistProgress(rows)).toEqual({ done: 2, total: 3 })
  })
})

describe('scoreScheinselbst — bogus self-employment risk scoring', () => {
  it('scores no markers as low risk with the full max score', () => {
    const result = scoreScheinselbst({})
    expect(result).toEqual({ score: 0, maxScore: 14, flaggedCount: 0, level: 'low' })
  })

  it('weights the four strong markers double', () => {
    const result = scoreScheinselbst({ single_client: true, no_own_employees: true })
    expect(result.score).toBe(3) // 2 + 1
    expect(result.flaggedCount).toBe(2)
    expect(result.level).toBe('low') // 3/14 ≈ 0.21
  })

  it('reaches medium risk between 30% and 60%', () => {
    const result = scoreScheinselbst({ single_client: true, integrated_org: true })
    expect(result.score).toBe(4) // 2 + 2 → 4/14 ≈ 0.29 → still low
    expect(result.level).toBe('low')
    const medium = scoreScheinselbst({ single_client: true, integrated_org: true, fixed_hours: true })
    expect(medium.score).toBe(5) // 5/14 ≈ 0.36
    expect(medium.level).toBe('medium')
  })

  it('flags high risk at or above 60% of the weighted score', () => {
    const result = scoreScheinselbst({
      single_client: true,
      client_instructions: true,
      integrated_org: true,
      no_entrepreneurial_risk: true,
      fixed_hours: true,
    })
    expect(result.score).toBe(9) // 8 + 1 → 9/14 ≈ 0.64
    expect(result.level).toBe('high')
  })
})

describe('parseAmountToken — German/Spanish/English number formats', () => {
  it('parses German grouping with decimal comma', () => {
    expect(parseAmountToken('5.000.000,00')).toBe(5000000)
    expect(parseAmountToken('1.234,56')).toBe(1234.56)
    expect(parseAmountToken('500,00')).toBe(500)
  })

  it('parses English grouping with decimal point', () => {
    expect(parseAmountToken('1,234.56')).toBe(1234.56)
  })

  it('treats a bare dot with 1–2 trailing digits as decimal, else thousands', () => {
    expect(parseAmountToken('1234.56')).toBe(1234.56)
    expect(parseAmountToken('1.000.000')).toBe(1000000)
  })

  it('returns null for non-numeric input', () => {
    expect(parseAmountToken('abc')).toBeNull()
  })
})

describe('parseDocumentFields — OCR field extraction', () => {
  it('extracts labelled issue/expiry dates and a coverage amount (German)', () => {
    const text = [
      'Haftpflichtversicherung',
      'Ausgestellt am 15.01.2026',
      'Gültig bis 15.01.2027',
      'Deckungssumme: 5.000.000,00 EUR',
    ].join('\n')
    expect(parseDocumentFields(text)).toEqual({
      issued_at: '2026-01-15',
      expires_at: '2027-01-15',
      amount: 5000000,
    })
  })

  it('reads Spanish labels and ISO dates', () => {
    const text = 'Válido hasta 2027-06-30\nImporte: 1.500,00 €'
    const result = parseDocumentFields(text)
    expect(result.expires_at).toBe('2027-06-30')
    expect(result.amount).toBe(1500)
  })

  it('falls back to earliest/latest when dates are unlabelled', () => {
    const result = parseDocumentFields('01.02.2025 ... 01.02.2028')
    expect(result.issued_at).toBe('2025-02-01')
    expect(result.expires_at).toBe('2028-02-01')
  })

  it('does not mistake a date for an amount', () => {
    // No amount label/currency → amount stays null even though the date has digits.
    expect(parseDocumentFields('Gültig bis 31.12.2026').amount).toBeNull()
  })

  it('returns all nulls for empty text', () => {
    expect(parseDocumentFields('')).toEqual({ issued_at: null, expires_at: null, amount: null })
  })
})
