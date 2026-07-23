import { describe, expect, it } from 'vitest'
import {
  applicableRequirements,
  computeAptitude,
  conditionsSatisfied,
  countryOriginBucket,
  coversAssignment,
  effectiveExpiryDate,
  evaluateRequirement,
  pendingMissingActions,
  reconcileChecklist,
} from '@/services/complianceRequirementEngine'
import type {
  AptitudeResult,
  ComplianceEntity,
  DocumentRequirement,
  EntityDocument,
} from '@/types/compliance'

const TODAY = '2026-07-23'

let reqCounter = 0
const requirement = (overrides: Partial<DocumentRequirement>): DocumentRequirement => ({
  id: `req-${++reqCounter}`,
  document_type_id: `dt-${overrides.document_type_code ?? 'generic'}`,
  document_type_code: 'generic',
  applies_to: 'freelancer',
  origin: 'ES',
  scope: 'entity',
  is_mandatory: true,
  conditions: {},
  validity_rule: 'no_expiry',
  validity_days: null,
  min_amount: null,
  requires_coverage_confirmation: false,
  notify_days: [30, 15, 7],
  on_missing_action: null,
  is_active: true,
  ...overrides,
})

const entity = (
  overrides: Partial<ComplianceEntity>,
): Pick<ComplianceEntity, 'kind' | 'country_code' | 'attributes'> => ({
  kind: 'freelancer',
  country_code: 'ES',
  attributes: {},
  ...overrides,
})

let itemCounter = 0
const item = (overrides: Partial<EntityDocument>): EntityDocument => ({
  id: `item-${++itemCounter}`,
  entity_id: 'entity-1',
  requirement_id: null,
  document_type_id: 'dt-generic',
  project_id: null,
  status: 'approved',
  current_version_id: 'v-1',
  approved_issued_at: '2026-01-01',
  approved_expires_at: '2027-01-01',
  approved_amount: null,
  coverage_confirmed: false,
  ...overrides,
})

describe('country origin buckets', () => {
  it('maps DE and ES to their own buckets', () => {
    expect(countryOriginBucket('DE')).toBe('DE')
    expect(countryOriginBucket('es')).toBe('ES')
  })

  it('maps other EU/EEA/CH members to EU_OTHER and the rest to NON_EU', () => {
    expect(countryOriginBucket('FR')).toBe('EU_OTHER')
    expect(countryOriginBucket('PT')).toBe('EU_OTHER')
    expect(countryOriginBucket('CH')).toBe('EU_OTHER')
    expect(countryOriginBucket('MA')).toBe('NON_EU')
    expect(countryOriginBucket(null)).toBe('NON_EU')
  })
})

describe('requirement applicability (conditions)', () => {
  it('uses subset semantics: empty conditions always apply', () => {
    expect(conditionsSatisfied({}, {})).toBe(true)
    expect(conditionsSatisfied({ regulated_trade: true }, {})).toBe(false)
    expect(conditionsSatisfied({ regulated_trade: true }, { regulated_trade: true })).toBe(true)
  })

  it('swaps S1 for EHIC on short stays', () => {
    const s1 = requirement({ document_type_code: 's1_certificate', conditions: { short_stay: false } })
    const ehic = requirement({ document_type_code: 'ehic_card', conditions: { short_stay: true } })

    const longStay = applicableRequirements([s1, ehic], entity({ attributes: { short_stay: false } }))
    expect(longStay.map((r) => r.document_type_code)).toEqual(['s1_certificate'])

    const shortStay = applicableRequirements([s1, ehic], entity({ attributes: { short_stay: true } }))
    expect(shortStay.map((r) => r.document_type_code)).toEqual(['ehic_card'])
  })

  it('adds company-level requirements when a freelancer starts hiring workers', () => {
    const base = requirement({ document_type_code: 'a1_certificate' })
    const milog = requirement({
      document_type_code: 'milog_declaration',
      scope: 'per_project',
      conditions: { hires_workers: true },
    })
    const soka = requirement({
      document_type_code: 'soka_bau_clearance',
      conditions: { hires_workers: true },
    })

    const solo = applicableRequirements([base, milog, soka], entity({}))
    expect(solo.map((r) => r.document_type_code)).toEqual(['a1_certificate'])

    const employer = applicableRequirements(
      [base, milog, soka],
      entity({ attributes: { hires_workers: true } }),
    )
    expect(employer.map((r) => r.document_type_code)).toEqual([
      'a1_certificate',
      'milog_declaration',
      'soka_bau_clearance',
    ])
  })

  it('ignores requirements for other kinds, origins and inactive rows', () => {
    const forCompanies = requirement({ applies_to: 'company' })
    const forGermans = requirement({ origin: 'DE' })
    const inactive = requirement({ is_active: false })
    const forAll = requirement({ origin: 'ALL', document_type_code: 'id_document' })
    const result = applicableRequirements(
      [forCompanies, forGermans, inactive, forAll],
      entity({}),
    )
    expect(result.map((r) => r.document_type_code)).toEqual(['id_document'])
  })
})

describe('checklist reconciliation (matrix changes)', () => {
  it('creates pending slots for new requirements without touching approved items', () => {
    const kept = requirement({ document_type_code: 'id_document' })
    const added = requirement({ document_type_code: 'soka_bau_clearance' })
    const existing = [
      item({ requirement_id: kept.id, document_type_id: kept.document_type_id, status: 'approved' }),
    ]

    const result = reconcileChecklist(entity({}), [kept, added], existing)
    expect(result.toCreate).toEqual([
      { requirement_id: added.id, document_type_id: added.document_type_id, project_id: null },
    ])
    expect(result.toMarkNotApplicable).toEqual([])
  })

  it('marks unapproved items of retired requirements as not_applicable, keeping approved history', () => {
    const retired = requirement({ document_type_code: 'old_doc', is_active: false })
    const pendingItem = item({ requirement_id: retired.id, status: 'pending' })
    const approvedItem = item({ requirement_id: retired.id, status: 'approved' })

    const result = reconcileChecklist(entity({}), [retired], [pendingItem, approvedItem])
    expect(result.toMarkNotApplicable).toEqual([pendingItem.id])
    expect(result.toCreate).toEqual([])
  })

  it('materializes per-project slots for every assigned obra', () => {
    const perObra = requirement({ document_type_code: 'milog_declaration', scope: 'per_project' })
    const result = reconcileChecklist(entity({}), [perObra], [], ['obra-1', 'obra-2'])
    expect(result.toCreate).toEqual([
      { requirement_id: perObra.id, document_type_id: perObra.document_type_id, project_id: 'obra-1' },
      { requirement_id: perObra.id, document_type_id: perObra.document_type_id, project_id: 'obra-2' },
    ])
  })

  it('never touches ad-hoc items (requirement_id null)', () => {
    const adHoc = item({ requirement_id: null, status: 'in_review' })
    const result = reconcileChecklist(entity({}), [], [adHoc])
    expect(result.toMarkNotApplicable).toEqual([])
  })
})

describe('A1 vs obra dates', () => {
  const window = { start_date: '2026-08-01', end_date: '2026-10-31' }

  it('accepts an A1 covering the whole assignment', () => {
    expect(
      coversAssignment(item({ approved_issued_at: '2026-07-01', approved_expires_at: '2026-12-31' }), window),
    ).toBe(true)
  })

  it('flags an approved A1 that does not cover the assignment window', () => {
    const a1 = requirement({
      document_type_code: 'a1_certificate',
      validity_rule: 'must_cover_assignment',
    })
    const doc = item({
      requirement_id: a1.id,
      status: 'approved',
      approved_issued_at: '2026-07-01',
      approved_expires_at: '2026-09-30', // ends before the obra does
    })
    const result = computeAptitude({
      entity: entity({}),
      requirements: [a1],
      items: [doc],
      projectId: 'obra-1',
      assignment: window,
      today: TODAY,
    })
    expect(result.level).toBe('red')
    expect(result.problems).toEqual([
      { severity: 'red', document_type: 'a1_certificate', reason: 'does_not_cover_assignment' },
    ])
  })

  it('falls back to a plain expiry check when no assignment window is known', () => {
    const a1 = requirement({
      document_type_code: 'a1_certificate',
      validity_rule: 'must_cover_assignment',
    })
    const expired = item({ requirement_id: a1.id, approved_expires_at: '2026-01-01' })
    expect(evaluateRequirement(a1, expired, { today: TODAY })).toMatchObject({ reason: 'expired' })
  })
})

describe('liability insurance validations', () => {
  const rc = requirement({
    document_type_code: 'rc_insurance',
    validity_rule: 'expiry_required',
    min_amount: 200000,
    requires_coverage_confirmation: true,
  })

  it('rejects coverage below the configured minimum', () => {
    const doc = item({ requirement_id: rc.id, approved_amount: 150000, coverage_confirmed: true })
    expect(evaluateRequirement(rc, doc, { today: TODAY })).toEqual({
      severity: 'red',
      document_type: 'rc_insurance',
      reason: 'amount_below_minimum',
    })
  })

  it('requires the reviewer-confirmed Germany coverage flag', () => {
    const doc = item({ requirement_id: rc.id, approved_amount: 250000, coverage_confirmed: false })
    expect(evaluateRequirement(rc, doc, { today: TODAY })).toEqual({
      severity: 'red',
      document_type: 'rc_insurance',
      reason: 'coverage_not_confirmed',
    })
  })

  it('passes with sufficient amount, confirmed coverage and future expiry', () => {
    const doc = item({ requirement_id: rc.id, approved_amount: 200000, coverage_confirmed: true })
    expect(evaluateRequirement(rc, doc, { today: TODAY })).toBeNull()
  })
})

describe('validity rules', () => {
  it('computes days_from_issue expiry (e.g. 90-day clearance certificates)', () => {
    const clearance = requirement({ validity_rule: 'days_from_issue', validity_days: 90 })
    expect(effectiveExpiryDate(clearance, item({ approved_issued_at: '2026-01-01' }))).toBe('2026-04-01')

    const stale = item({ requirement_id: clearance.id, approved_issued_at: '2026-01-01' })
    expect(evaluateRequirement(clearance, stale, { today: TODAY })).toMatchObject({ reason: 'expired' })

    const fresh = item({ requirement_id: clearance.id, approved_issued_at: '2026-07-01' })
    expect(evaluateRequirement(clearance, fresh, { today: TODAY })).toBeNull()
  })

  it('treats expiring documents as warnings, not blockers', () => {
    const req = requirement({ validity_rule: 'expiry_required' })
    const doc = item({ requirement_id: req.id, status: 'expiring', approved_expires_at: '2026-08-01' })
    expect(evaluateRequirement(req, doc, { today: TODAY })).toEqual({
      severity: 'yellow',
      document_type: 'generic',
      reason: 'expiring_soon',
    })
  })

  it('treats missing optional documents as warnings', () => {
    const optional = requirement({ is_mandatory: false, document_type_code: 'wage_payment_proof' })
    const result = computeAptitude({
      entity: entity({}),
      requirements: [optional],
      items: [],
      today: TODAY,
    })
    expect(result.level).toBe('yellow')
    expect(result.problems).toEqual([
      { severity: 'yellow', document_type: 'wage_payment_proof', reason: 'optional_missing' },
    ])
  })
})

describe('aptitude traffic light', () => {
  it('is green when every applicable mandatory requirement is approved and valid', () => {
    const req = requirement({ validity_rule: 'expiry_required' })
    const result = computeAptitude({
      entity: entity({}),
      requirements: [req],
      items: [item({ requirement_id: req.id })],
      today: TODAY,
    })
    expect(result).toEqual({ level: 'green', problems: [] })
  })

  it('lists exactly what is missing when red', () => {
    const a1 = requirement({ document_type_code: 'a1_certificate' })
    const idDoc = requirement({ document_type_code: 'id_document', validity_rule: 'expiry_required' })
    const result = computeAptitude({
      entity: entity({}),
      requirements: [a1, idDoc],
      items: [item({ requirement_id: idDoc.id })],
      today: TODAY,
    })
    expect(result.level).toBe('red')
    expect(result.problems).toEqual([
      { severity: 'red', document_type: 'a1_certificate', reason: 'missing' },
    ])
  })

  it('skips per-project requirements when evaluating without an obra', () => {
    const perObra = requirement({ scope: 'per_project', document_type_code: 'milog_declaration' })
    const noProject = computeAptitude({
      entity: entity({}),
      requirements: [perObra],
      items: [],
      today: TODAY,
    })
    expect(noProject.level).toBe('green')

    const withProject = computeAptitude({
      entity: entity({}),
      requirements: [perObra],
      items: [],
      projectId: 'obra-1',
      today: TODAY,
    })
    expect(withProject.level).toBe('red')
  })

  it('caps a company worker by its company aptitude', () => {
    const workerEntity = entity({ kind: 'company_worker' })
    const companyRed: AptitudeResult = {
      level: 'red',
      problems: [{ severity: 'red', document_type: 'soka_bau_clearance', reason: 'missing' }],
    }
    const result = computeAptitude({
      entity: workerEntity,
      requirements: [],
      items: [],
      parentAptitude: companyRed,
      today: TODAY,
    })
    expect(result.level).toBe('red')
    expect(result.problems).toEqual([
      { severity: 'red', document_type: null, reason: 'company_not_apt' },
    ])
  })
})

describe('on_missing_action side effects (§48b withholding)', () => {
  it('reports the billing-withholding action while the Freistellung is not approved', () => {
    const freistellung = requirement({
      document_type_code: 'freistellung_48b',
      is_mandatory: false,
      validity_rule: 'expiry_required',
      on_missing_action: 'notify_billing_withholding',
    })
    const missing = pendingMissingActions({
      entity: entity({ country_code: 'DE' }),
      requirements: [{ ...freistellung, origin: 'DE' }],
      items: [],
      today: TODAY,
    })
    expect(missing.map((r) => r.on_missing_action)).toEqual(['notify_billing_withholding'])

    const approved = pendingMissingActions({
      entity: entity({ country_code: 'DE' }),
      requirements: [{ ...freistellung, origin: 'DE' }],
      items: [item({ requirement_id: freistellung.id, approved_expires_at: '2027-12-31' })],
      today: TODAY,
    })
    expect(approved).toEqual([])
  })
})
