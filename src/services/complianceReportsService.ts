// Aggregate compliance reports (Fase 5b) — read-only, frontend-composed.
//
// Built entirely on top of the demo-tested primitives (fetchEntities /
// fetchRequirements / fetchChecklist / computeAptitude) so it needs no new
// Supabase query shapes and works identically online and in demo mode. It is an
// admin, on-demand action (not a hot path), so the per-entity checklist fan-out
// is acceptable.

import {
  fetchChecklist,
  fetchEntities,
  fetchRequirements,
} from '@/services/complianceService'
import type { ComplianceEntityRecord } from '@/services/complianceService'
import { computeAptitude } from '@/services/complianceRequirementEngine'
import type {
  AptitudeLevel,
  ComplianceEntityKind,
  EntityDocumentStatus,
} from '@/types/compliance'

/** One document approaching or past its expiry, across all entities. */
export interface ExpiringDocRow {
  entityId: string
  entityName: string
  entityKind: ComplianceEntityKind
  /** Parent company name when the row belongs to a posted worker. */
  parentName: string | null
  docName: Record<string, string>
  code: string
  status: EntityDocumentStatus
  expiresAt: string
  /** Whole days until expiry; negative = already expired. */
  daysLeft: number
}

/** One top-level entity's aptitude snapshot for the portfolio overview. */
export interface PortfolioRow {
  entity: ComplianceEntityRecord
  level: AptitudeLevel
  problemCount: number
  workerCount: number
  /** Expiring/expired documents within the window, self + workers. */
  expiringCount: number
}

export interface ComplianceReports {
  generatedAt: string
  windowDays: number
  expiring: ExpiringDocRow[]
  portfolio: PortfolioRow[]
  summary: {
    entities: number
    green: number
    yellow: number
    red: number
    /** In [0, window] — not yet expired. */
    expiringSoon: number
    /** daysLeft < 0. */
    expired: number
  }
}

/** Europe/Berlin calendar date as YYYY-MM-DD, matching the aptitude engine. */
function berlinToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}

function daysUntil(expiresAt: string, today: string): number {
  const target = Date.parse(`${expiresAt.slice(0, 10)}T00:00:00Z`)
  const base = Date.parse(`${today}T00:00:00Z`)
  return Math.round((target - base) / 86_400_000)
}

/**
 * Assembles the aggregate {@link ComplianceReports}: documents expiring within
 * `withinDays` (including already-expired) and the aptitude portfolio for every
 * top-level entity (companies, freelancers, internal employees; posted workers
 * roll up into their company).
 */
export async function fetchComplianceReports(
  withinDays = 30,
): Promise<{ data: ComplianceReports | null; error: string | null }> {
  const { data: requirements, error: reqError } = await fetchRequirements()
  if (reqError) return { data: null, error: reqError }
  const { data: entities, error: entError } = await fetchEntities()
  if (entError) return { data: null, error: entError }

  const today = berlinToday()
  const nameById = new Map(entities.map((entity) => [entity.id, entity.display_name]))

  // Checklist per entity (drives both the expiring list and the aptitude calc).
  const itemsByEntity = new Map<string, Awaited<ReturnType<typeof fetchChecklist>>['data']>()
  for (const entity of entities) {
    const { data, error } = await fetchChecklist(entity.id, requirements)
    if (error) return { data: null, error }
    itemsByEntity.set(entity.id, data)
  }

  // Expiring / expired documents across every entity.
  const expiring: ExpiringDocRow[] = []
  for (const entity of entities) {
    for (const view of itemsByEntity.get(entity.id) ?? []) {
      const expiresAt = view.item.approved_expires_at
      if (!expiresAt || view.item.status === 'not_applicable') continue
      const daysLeft = daysUntil(expiresAt, today)
      if (daysLeft > withinDays) continue
      expiring.push({
        entityId: entity.id,
        entityName: entity.display_name,
        entityKind: entity.kind,
        parentName: entity.parent_entity_id ? (nameById.get(entity.parent_entity_id) ?? null) : null,
        docName: view.documentType.name_i18n,
        code: view.documentType.code,
        status: view.item.status,
        expiresAt: expiresAt.slice(0, 10),
        daysLeft,
      })
    }
  }
  expiring.sort((a, b) => a.daysLeft - b.daysLeft)

  // Expiring counts grouped by the owning top-level entity (worker → company).
  const expiringByTopLevel = new Map<string, number>()
  for (const row of expiring) {
    const topId = row.parentName
      ? (entities.find((e) => e.id === row.entityId)?.parent_entity_id ?? row.entityId)
      : row.entityId
    expiringByTopLevel.set(topId, (expiringByTopLevel.get(topId) ?? 0) + 1)
  }

  // Aptitude portfolio for top-level entities.
  const portfolio: PortfolioRow[] = []
  const summary = { entities: 0, green: 0, yellow: 0, red: 0, expiringSoon: 0, expired: 0 }
  for (const entity of entities) {
    if (entity.kind === 'company_worker') continue
    const aptitude = computeAptitude({
      entity,
      requirements,
      items: (itemsByEntity.get(entity.id) ?? []).map((view) => view.item),
      projectId: null,
    })
    portfolio.push({
      entity,
      level: aptitude.level,
      problemCount: aptitude.problems.length,
      workerCount: entities.filter((w) => w.parent_entity_id === entity.id).length,
      expiringCount: expiringByTopLevel.get(entity.id) ?? 0,
    })
    summary.entities += 1
    summary[aptitude.level] += 1
  }
  portfolio.sort((a, b) => a.entity.display_name.localeCompare(b.entity.display_name))

  for (const row of expiring) {
    if (row.daysLeft < 0) summary.expired += 1
    else summary.expiringSoon += 1
  }

  return {
    data: { generatedAt: new Date().toISOString(), windowDays: withinDays, expiring, portfolio, summary },
    error: null,
  }
}
