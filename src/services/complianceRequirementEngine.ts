// Pure requirement-matrix engine for the personnel compliance module.
//
// This is the TypeScript twin of the SQL side (043_compliance_aptitude.sql):
//   - country bucket mapping   ↔ public.country_origin_bucket()
//   - applicability            ↔ public.applicable_requirement_ids()
//   - aptitude evaluation      ↔ public.compute_entity_aptitude()
// The SQL functions are authoritative for enforcement (assignment/cert gates);
// this module powers checklist materialization, form-level validation messages
// and the UI, and is what the vitest suite exercises. Keep both in sync.
//
// All dates are ISO `YYYY-MM-DD` strings compared lexicographically; "today"
// is injected (defaulting to Europe/Berlin) so the logic stays deterministic.

import type {
  AptitudeProblem,
  AptitudeResult,
  AssignmentWindow,
  ChecklistReconciliation,
  ComplianceEntity,
  DocumentRequirement,
  EntityAttributes,
  EntityDocument,
  RequirementOrigin,
} from '@/types/compliance'

// EU + EEA + CH (A1 coordination area), minus DE/ES which have own buckets.
const EU_OTHER_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI',
  'SK', 'IS', 'LI', 'NO', 'CH',
])

export function countryOriginBucket(countryCode: string | null | undefined): RequirementOrigin {
  const code = (countryCode ?? '').toUpperCase()
  if (code === 'DE') return 'DE'
  if (code === 'ES') return 'ES'
  if (EU_OTHER_COUNTRIES.has(code)) return 'EU_OTHER'
  return 'NON_EU'
}

/** Subset semantics, mirroring JSONB containment (conditions <@ attributes). */
export function conditionsSatisfied(
  conditions: EntityAttributes,
  attributes: EntityAttributes,
): boolean {
  return Object.entries(conditions).every(([key, value]) => attributes[key] === value)
}

export function requirementApplies(
  requirement: DocumentRequirement,
  entity: Pick<ComplianceEntity, 'kind' | 'country_code' | 'attributes'>,
): boolean {
  if (!requirement.is_active) return false
  if (requirement.applies_to !== entity.kind) return false
  if (requirement.origin !== 'ALL' && requirement.origin !== countryOriginBucket(entity.country_code)) {
    return false
  }
  return conditionsSatisfied(requirement.conditions, entity.attributes ?? {})
}

export function applicableRequirements(
  requirements: DocumentRequirement[],
  entity: Pick<ComplianceEntity, 'kind' | 'country_code' | 'attributes'>,
): DocumentRequirement[] {
  return requirements.filter((req) => requirementApplies(req, entity))
}

// ─────────────────────────────────────────────────────────────────────────────
// Checklist materialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Diff the entity's materialized checklist against the current matrix.
 * Called on entity creation, attribute/country changes, project assignment,
 * and after Administration edits the matrix ("recalcular checklists").
 *
 * - Applicable requirements without a slot → create as `pending`
 *   (entity scope → one slot; per_project scope → one slot per assigned obra).
 * - Existing matrix-driven items whose requirement no longer applies → mark
 *   `not_applicable`, EXCEPT approved/expiring/expired ones, which are kept
 *   untouched as history ("sin borrar lo aprobado").
 * - Ad-hoc items (requirement_id null) are never touched.
 */
export function reconcileChecklist(
  entity: Pick<ComplianceEntity, 'kind' | 'country_code' | 'attributes'>,
  requirements: DocumentRequirement[],
  existingItems: EntityDocument[],
  assignedProjectIds: string[] = [],
): ChecklistReconciliation {
  const applicable = applicableRequirements(requirements, entity)
  const applicableIds = new Set(applicable.map((req) => req.id))

  const slotKey = (requirementId: string, projectId: string | null) =>
    `${requirementId}::${projectId ?? ''}`
  const existingSlots = new Set(
    existingItems
      .filter((item) => item.requirement_id !== null)
      .map((item) => slotKey(item.requirement_id as string, item.project_id)),
  )

  const toCreate: ChecklistReconciliation['toCreate'] = []
  for (const req of applicable) {
    const projectTargets = req.scope === 'per_project' ? assignedProjectIds : [null]
    for (const projectId of projectTargets) {
      if (!existingSlots.has(slotKey(req.id, projectId))) {
        toCreate.push({
          requirement_id: req.id,
          document_type_id: req.document_type_id,
          project_id: projectId,
        })
      }
    }
  }

  const KEEP_STATUSES = new Set(['approved', 'expiring', 'expired', 'not_applicable'])
  const toMarkNotApplicable = existingItems
    .filter(
      (item) =>
        item.requirement_id !== null &&
        !applicableIds.has(item.requirement_id) &&
        !KEEP_STATUSES.has(item.status),
    )
    .map((item) => item.id)

  return { toCreate, toMarkNotApplicable }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validity + aptitude evaluation
// ─────────────────────────────────────────────────────────────────────────────

export function todayInBerlin(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Effective expiry date of an approved item under its requirement's rule,
 * or null when the rule has no expiry / dates are missing.
 */
export function effectiveExpiryDate(
  requirement: Pick<DocumentRequirement, 'validity_rule' | 'validity_days'>,
  item: Pick<EntityDocument, 'approved_issued_at' | 'approved_expires_at'>,
): string | null {
  switch (requirement.validity_rule) {
    case 'days_from_issue':
      return item.approved_issued_at && requirement.validity_days !== null
        ? addDays(item.approved_issued_at, requirement.validity_days)
        : null
    case 'expiry_required':
    case 'must_cover_assignment':
      return item.approved_expires_at
    case 'no_expiry':
      return null
  }
}

/**
 * Explicit A1-style check: the approved document must cover the whole
 * assignment window [start, end].
 */
export function coversAssignment(
  item: Pick<EntityDocument, 'approved_issued_at' | 'approved_expires_at'>,
  assignment: AssignmentWindow,
): boolean {
  return (
    item.approved_issued_at !== null &&
    item.approved_expires_at !== null &&
    item.approved_issued_at <= assignment.start_date &&
    item.approved_expires_at >= assignment.end_date
  )
}

interface EvaluationContext {
  today: string
  /** Window of the assignment being evaluated (must_cover_assignment). */
  assignment?: AssignmentWindow | null
}

/**
 * Evaluate one applicable requirement against its checklist item.
 * Returns null when fully satisfied; mirrors compute_entity_aptitude().
 */
export function evaluateRequirement(
  requirement: DocumentRequirement,
  item: EntityDocument | undefined,
  context: EvaluationContext,
): AptitudeProblem | null {
  const problem = (reason: string): AptitudeProblem => {
    const warning = reason === 'expiring_soon' || !requirement.is_mandatory
    return {
      severity: warning ? 'yellow' : 'red',
      document_type: requirement.document_type_code,
      reason:
        !requirement.is_mandatory && reason !== 'expiring_soon' ? `optional_${reason}` : reason,
    }
  }

  if (!item || item.status === 'pending' || item.status === 'not_applicable') {
    return problem('missing')
  }
  if (item.status === 'in_review' || item.status === 'rejected' || item.status === 'expired') {
    return problem(item.status)
  }

  // approved / expiring — validate against reviewer-confirmed metadata.
  if (requirement.validity_rule === 'expiry_required') {
    if (!item.approved_expires_at || item.approved_expires_at < context.today) {
      return problem('expired')
    }
  } else if (requirement.validity_rule === 'days_from_issue') {
    const expiresOn = effectiveExpiryDate(requirement, item)
    if (!expiresOn || expiresOn < context.today) {
      return problem('expired')
    }
  } else if (requirement.validity_rule === 'must_cover_assignment') {
    if (context.assignment) {
      if (!coversAssignment(item, context.assignment)) {
        return problem('does_not_cover_assignment')
      }
    } else if (item.approved_expires_at && item.approved_expires_at < context.today) {
      return problem('expired')
    }
  }

  if (
    requirement.min_amount !== null &&
    (item.approved_amount === null || item.approved_amount < requirement.min_amount)
  ) {
    return problem('amount_below_minimum')
  }

  if (requirement.requires_coverage_confirmation && !item.coverage_confirmed) {
    return problem('coverage_not_confirmed')
  }

  if (item.status === 'expiring') {
    return problem('expiring_soon')
  }

  return null
}

export interface AptitudeInput {
  entity: Pick<ComplianceEntity, 'kind' | 'country_code' | 'attributes'>
  requirements: DocumentRequirement[]
  items: EntityDocument[]
  /** Obra being evaluated; per_project requirements are skipped without it. */
  projectId?: string | null
  assignment?: AssignmentWindow | null
  /** Company aptitude for the same obra — caps company_worker results. */
  parentAptitude?: AptitudeResult | null
  today?: string
}

export function computeAptitude(input: AptitudeInput): AptitudeResult {
  const today = input.today ?? todayInBerlin()
  const projectId = input.projectId ?? null
  const problems: AptitudeProblem[] = []

  for (const req of applicableRequirements(input.requirements, input.entity)) {
    if (req.scope === 'per_project' && projectId === null) continue

    const item = input.items.find(
      (candidate) =>
        candidate.requirement_id === req.id &&
        (req.scope === 'entity'
          ? candidate.project_id === null
          : candidate.project_id === projectId),
    )
    const result = evaluateRequirement(req, item, { today, assignment: input.assignment })
    if (result) problems.push(result)
  }

  if (input.entity.kind === 'company_worker' && input.parentAptitude) {
    if (input.parentAptitude.level === 'red') {
      problems.push({ severity: 'red', document_type: null, reason: 'company_not_apt' })
    } else if (input.parentAptitude.level === 'yellow') {
      problems.push({ severity: 'yellow', document_type: null, reason: 'company_has_warnings' })
    }
  }

  const level = problems.some((p) => p.severity === 'red')
    ? 'red'
    : problems.length > 0
      ? 'yellow'
      : 'green'
  return { level, problems }
}

/**
 * Requirements whose on_missing_action fires because the document is not
 * currently approved and valid — e.g. §48b Freistellungsbescheinigung missing
 * → billing must withhold the 15% Bauabzugsteuer.
 */
export function pendingMissingActions(input: AptitudeInput): DocumentRequirement[] {
  const today = input.today ?? todayInBerlin()
  return applicableRequirements(input.requirements, input.entity).filter((req) => {
    if (!req.on_missing_action) return false
    if (req.scope === 'per_project' && (input.projectId ?? null) === null) return false
    const item = input.items.find(
      (candidate) =>
        candidate.requirement_id === req.id &&
        (req.scope === 'entity'
          ? candidate.project_id === null
          : candidate.project_id === input.projectId),
    )
    return evaluateRequirement(req, item, { today, assignment: input.assignment }) !== null
  })
}
