import { beforeEach, describe, expect, it, vi } from 'vitest'

// Route the compliance services through the in-memory demo client so they
// exercise the seeded fixtures (mirrors how the other *Demo tests work, but at
// the service layer). The demo client reads the shared store on every call, so
// resetStore() between tests reseeds cleanly.
vi.mock('@/lib/supabase', async () => {
  const { createDemoSupabaseClient } = await import('@/lib/demo/supabase-mock')
  return { supabase: createDemoSupabaseClient(), isDemoSupabase: true }
})

const { supabase } = await import('@/lib/supabase')
import { resetStore } from '@/lib/demo/store'
import {
  approveDocument,
  assignmentKey,
  createDocumentType,
  createRequirement,
  deleteEntity,
  eraseEntityPersonalData,
  extractDocumentFields,
  fetchAssignedProjectIds,
  fetchChecklist,
  fetchComplianceForAssignments,
  fetchDocumentTypes,
  fetchEntities,
  fetchEntityByProfileId,
  fetchEntityDeletionImpact,
  fetchEntityDossier,
  fetchProfileCompliance,
  fetchRequirements,
  fetchReviewQueue,
  getTemplateSignedUrl,
  saveScheinselbstCheck,
  updateRequirement,
  uploadTemplate,
} from '@/services/complianceService'
import { fetchComplianceReports } from '@/services/complianceReportsService'
import { fetchOrderComplianceMap } from '@/services/workOrderService'
import { billingWithholding } from '@/services/complianceHelpers'
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllRead,
  markRead,
} from '@/services/notificationInboxService'

const CONTRACTOR_ID = '00000000-0000-0000-0000-000000000003'
const TECH_ID = '00000000-0000-0000-0000-000000000002'
const ADMIN_ID = '00000000-0000-0000-0000-000000000001'
const PROJECT_HXT = '20000000-0000-0000-0000-000000000001'
const COMPANY_ENTITY = 'ce000000-0000-0000-0000-000000000001'
const SS_ITEM_IN_REVIEW = 'ed000000-0000-0000-0000-000000000003'

// The compliance services read the module-level `supabase` singleton, which is
// the demo mock when VITE_DEMO is set for the test env. resetStore() reseeds the
// fixtures before each test so state does not leak between cases.
beforeEach(() => {
  resetStore()
})

describe('demo compliance — entity + checklist wiring', () => {
  it('resolves the demo contractor to its company compliance entity', async () => {
    const { data, error } = await fetchEntityByProfileId(CONTRACTOR_ID)
    expect(error).toBeNull()
    expect(data?.id).toBe(COMPANY_ENTITY)
    expect(data?.kind).toBe('company')
  })

  it('builds the company checklist joined with type, requirement and version', async () => {
    const { data: requirements } = await fetchRequirements()
    const { data: rows, error } = await fetchChecklist(COMPANY_ENTITY, requirements)
    expect(error).toBeNull()
    expect(rows.length).toBeGreaterThan(0)
    const rc = rows.find((row) => row.documentType.code === 'rc_insurance')
    expect(rc?.item.status).toBe('approved')
    expect(rc?.requirement?.min_amount).toBe(500000)
    expect(rc?.currentVersion?.file_name).toBe('seguro-rc.pdf')
  })
})

describe('demo compliance — review inbox', () => {
  it('lists only in_review items with entity + version context', async () => {
    const { data, error } = await fetchReviewQueue()
    expect(error).toBeNull()
    expect(data.map((entry) => entry.item.id)).toEqual([SS_ITEM_IN_REVIEW])
    expect(data[0].entity.display_name).toBe('Fibra Ibérica S.L.')
    expect(data[0].currentVersion?.version_number).toBe(1)
  })

  it('approving a document clears it from the queue and stamps approved metadata', async () => {
    const queue = await fetchReviewQueue()
    const entry = queue.data[0]
    const { error } = await approveDocument({
      itemId: entry.item.id,
      versionId: entry.currentVersion!.id,
      reviewerId: '00000000-0000-0000-0000-000000000001',
      approved: { issued_at: '2026-04-20', expires_at: null, amount: null },
    })
    expect(error).toBeNull()

    const after = await fetchReviewQueue()
    expect(after.data.map((e) => e.item.id)).not.toContain(SS_ITEM_IN_REVIEW)
  })
})

describe('demo compliance — upload edge function (mock)', () => {
  it('records a new version and moves a pending item into review', async () => {
    // Sign in so the mock associates the upload with a user.
    await supabase.auth.signInWithPassword({ email: 'admin@demo.lumen', password: 'demo123' })

    const form = new FormData()
    form.append('entity_document_id', 'ed000000-0000-0000-0000-000000000008')
    form.append('metadata', JSON.stringify({ issued_at: '2026-04-01' }))
    form.append('file', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'dni.pdf', { type: 'application/pdf' }))

    const { data, error } = await supabase.functions.invoke('compliance-upload', {
      body: form as unknown as Record<string, unknown>,
    })
    expect(error).toBeNull()
    expect((data as { version?: { version_number?: number } })?.version?.version_number).toBe(1)

    const { data: item } = await supabase
      .from('entity_documents')
      .select('*')
      .eq('id', 'ed000000-0000-0000-0000-000000000008')
      .single()
    expect((item as { status?: string })?.status).toBe('in_review')
  })

  it('direct_approve uploads land as approved in one step (internal personnel flow)', async () => {
    await supabase.auth.signInWithPassword({ email: 'admin@demo.lumen', password: 'demo123' })

    const form = new FormData()
    form.append('entity_document_id', 'ed000000-0000-0000-0000-000000000010')
    form.append('metadata', JSON.stringify({}))
    form.append('direct_approve', 'true')
    form.append('file', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'ausweis.pdf', { type: 'application/pdf' }))

    const { error } = await supabase.functions.invoke('compliance-upload', {
      body: form as unknown as Record<string, unknown>,
    })
    expect(error).toBeNull()

    const { data: item } = await supabase
      .from('entity_documents')
      .select('*')
      .eq('id', 'ed000000-0000-0000-0000-000000000010')
      .single()
    expect((item as { status?: string })?.status).toBe('approved')
  })
})

describe('demo compliance — aptitude pre-flight mirrors the DB gate', () => {
  it('blocks the company while a mandatory doc is still in review', async () => {
    const { data } = await fetchProfileCompliance(CONTRACTOR_ID, '20000000-0000-0000-0000-000000000001')
    expect(data.hasEntity).toBe(true)
    // ss_clearance_national is in_review (seeded for the admin inbox demo), so
    // the company is not yet apt — same verdict the DB trigger would give.
    expect(data.isBlocked).toBe(true)
    expect(data.missingCodes).toContain('ss_clearance_national')
  })

  it('becomes apt once the pending review is approved', async () => {
    const queue = await fetchReviewQueue()
    const entry = queue.data[0]
    // ss_clearance is days_from_issue(90); approve with a fresh issue date so it
    // is not immediately expired against "today".
    const today = new Date().toISOString().slice(0, 10)
    await approveDocument({
      itemId: entry.item.id,
      versionId: entry.currentVersion!.id,
      reviewerId: '00000000-0000-0000-0000-000000000001',
      approved: { issued_at: today, expires_at: null, amount: null },
    })
    const { data } = await fetchProfileCompliance(CONTRACTOR_ID, '20000000-0000-0000-0000-000000000001')
    expect(data.isBlocked).toBe(false)
  })

  it('blocks a profile with no compliance entity', async () => {
    const { data } = await fetchProfileCompliance('00000000-0000-0000-0000-000000000002')
    expect(data.hasEntity).toBe(false)
    expect(data.isBlocked).toBe(true)
  })
})

describe('demo compliance — per-obra semáforo (Fase 3)', () => {
  it('batches aptitude per (contractor, obra) pair with a stable key', async () => {
    const { data, error } = await fetchComplianceForAssignments([
      { profileId: CONTRACTOR_ID, projectId: PROJECT_HXT },
    ])
    expect(error).toBeNull()
    const result = data.get(assignmentKey(CONTRACTOR_ID, PROJECT_HXT))
    expect(result?.hasEntity).toBe(true)
    expect(result?.isBlocked).toBe(true)
    expect(result?.missingCodes).toContain('ss_clearance_national')
  })

  it('order map covers only contractor assignees, skipping teams and internal techs', async () => {
    const map = await fetchOrderComplianceMap([
      { assigned_technician: CONTRACTOR_ID, project_id: PROJECT_HXT },
      { assigned_technician: TECH_ID, project_id: PROJECT_HXT },
      { assigned_technician: null, project_id: PROJECT_HXT },
    ])
    expect(map.has(assignmentKey(CONTRACTOR_ID, PROJECT_HXT))).toBe(true)
    expect(map.has(assignmentKey(TECH_ID, PROJECT_HXT))).toBe(false)
  })
})

describe('demo compliance — §48b withholding chip (Fase 4)', () => {
  it('flags 15% withholding while the Freistellung §48b is not approved', async () => {
    const { data: requirements } = await fetchRequirements()
    const { data: rows } = await fetchChecklist(COMPANY_ENTITY, requirements)
    const freistellung = rows.find((row) => row.documentType.code === 'freistellung_48b')
    expect(freistellung?.item.status).toBe('pending')
    expect(billingWithholding(rows)).toBe(true)
  })
})

describe('demo compliance — in-app notification inbox (Fase 4)', () => {
  it('returns the seeded unread notifications for the admin', async () => {
    expect(await fetchUnreadCount(ADMIN_ID)).toBe(2)
    const { data, error } = await fetchNotifications(ADMIN_ID)
    expect(error).toBeNull()
    expect(data.length).toBe(2)
    expect(data.map((n) => n.category)).toEqual(
      expect.arrayContaining(['doc_rejected', 'doc_expiring']),
    )
  })

  it('marking one read drops the unread count', async () => {
    const { data } = await fetchNotifications(ADMIN_ID)
    await markRead(data[0].id)
    expect(await fetchUnreadCount(ADMIN_ID)).toBe(1)
  })

  it('mark-all-read clears the unread count', async () => {
    await markAllRead(ADMIN_ID)
    expect(await fetchUnreadCount(ADMIN_ID)).toBe(0)
  })
})

describe('demo compliance — inspection dossier assembly (Fase 5)', () => {
  it('assembles the company section, aptitude and each posted worker', async () => {
    const { data: entity } = await fetchEntityByProfileId(CONTRACTOR_ID)
    expect(entity).not.toBeNull()
    const { data: dossier, error } = await fetchEntityDossier(entity!)
    expect(error).toBeNull()
    expect(dossier).not.toBeNull()

    expect(dossier!.main.entity.id).toBe(COMPANY_ENTITY)
    expect(dossier!.main.items.length).toBeGreaterThan(0)
    expect(['green', 'yellow', 'red']).toContain(dossier!.main.aptitude.level)

    // Both seeded posted workers, each with its own checklist + aptitude.
    expect(dossier!.workers.map((w) => w.entity.display_name)).toEqual(
      expect.arrayContaining(['Carlos Méndez', 'Luis Fernández']),
    )
    for (const worker of dossier!.workers) {
      expect(worker.entity.kind).toBe('company_worker')
      expect(['green', 'yellow', 'red']).toContain(worker.aptitude.level)
    }
  })
})

describe('demo compliance — aggregate reports (Fase 5b)', () => {
  it('lists the expired worker A1 attributed to its parent company', async () => {
    const { data, error } = await fetchComplianceReports()
    expect(error).toBeNull()
    expect(data).not.toBeNull()

    const expired = data!.expiring.find((row) => row.status === 'expired')
    expect(expired).toBeDefined()
    expect(expired!.daysLeft).toBeLessThan(0)
    expect(expired!.parentName).toBe('Fibra Ibérica S.L.')
    expect(data!.summary.expired).toBeGreaterThanOrEqual(1)
  })

  it('builds the aptitude portfolio for top-level entities only', async () => {
    const { data } = await fetchComplianceReports()
    const names = data!.portfolio.map((row) => row.entity.display_name)
    expect(names).toContain('Fibra Ibérica S.L.')
    // Posted workers never appear as their own portfolio row.
    expect(names).not.toContain('Carlos Méndez')
    expect(data!.summary.entities).toBe(data!.portfolio.length)
  })
})

describe('demo compliance — matrix configurator CRUD (Fase 5c)', () => {
  it('creates a document type and a linked requirement', async () => {
    const { data: type, error: typeError } = await createDocumentType({
      code: 'test_doc',
      name_i18n: { es: 'Prueba', de: 'Test' },
      description_i18n: null,
    })
    expect(typeError).toBeNull()
    expect(type?.id).toBeTruthy()

    const { data: req, error: reqError } = await createRequirement({
      document_type_id: type!.id,
      applies_to: 'company',
      origin: 'ALL',
      scope: 'entity',
      is_mandatory: true,
      conditions: {},
      validity_rule: 'no_expiry',
      validity_days: null,
      min_amount: null,
      requires_coverage_confirmation: false,
      notify_days: [30],
      on_missing_action: null,
    })
    expect(reqError).toBeNull()
    const { data: all } = await fetchRequirements(true)
    expect(all.some((r) => r.id === req!.id)).toBe(true)
  })

  it('deactivating a requirement hides it from the active fetch only', async () => {
    const { data: type } = await createDocumentType({
      code: 'test_doc2',
      name_i18n: { es: 'Prueba 2', de: 'Test 2' },
      description_i18n: null,
    })
    const { data: req } = await createRequirement({
      document_type_id: type!.id,
      applies_to: 'freelancer',
      origin: 'DE',
      scope: 'entity',
      is_mandatory: false,
      conditions: { regulated_trade: true },
      validity_rule: 'no_expiry',
      validity_days: null,
      min_amount: null,
      requires_coverage_confirmation: false,
      notify_days: [30],
      on_missing_action: null,
    })
    await updateRequirement(req!.id, { is_active: false })

    const { data: active } = await fetchRequirements(false)
    expect(active.some((r) => r.id === req!.id)).toBe(false)
    const { data: all } = await fetchRequirements(true)
    expect(all.some((r) => r.id === req!.id)).toBe(true)
  })
})

describe('demo compliance — document type templates (Fase 5d)', () => {
  it('uploads a PDF template and records its path on the document type', async () => {
    const { data: type } = await createDocumentType({
      code: 'tpl_doc',
      name_i18n: { es: 'Con plantilla', de: 'Mit Vorlage' },
      description_i18n: null,
    })
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'formular.pdf', { type: 'application/pdf' })
    const { data: path, error } = await uploadTemplate(
      { id: type!.id, code: type!.code, template_storage_path: null },
      file,
    )
    expect(error).toBeNull()
    expect(path).toMatch(/^templates\/tpl_doc\//)

    const { data: types } = await fetchDocumentTypes(true)
    expect(types.find((d) => d.id === type!.id)?.template_storage_path).toBe(path)

    const { data: url } = await getTemplateSignedUrl(path!)
    expect(url).toBeTruthy()
  })

  it('rejects a non-PDF template by magic bytes', async () => {
    const { data: type } = await createDocumentType({
      code: 'tpl_doc2',
      name_i18n: { es: 'X', de: 'X' },
      description_i18n: null,
    })
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'form.jpg', { type: 'image/jpeg' })
    const { error } = await uploadTemplate({ id: type!.id, code: type!.code }, jpeg)
    expect(error).toBe('file_type_not_allowed')
  })
})

describe('demo compliance — Scheinselbstständigkeit risk assessment (Fase 6a)', () => {
  it('reads the seeded freelancer as high risk', async () => {
    const { data: entities } = await fetchEntities({ includeInactive: true })
    const freelancer = entities.find((entity) => entity.kind === 'freelancer')
    expect(freelancer).toBeDefined()
    expect(freelancer!.scheinselbst_check?.level).toBe('high')
    expect(freelancer!.scheinselbst_check?.score).toBe(9)
  })

  it('re-assessing recomputes the score/level and persists the snapshot', async () => {
    const { data: entities } = await fetchEntities({ includeInactive: true })
    const freelancer = entities.find((entity) => entity.kind === 'freelancer')!

    const { data: updated, error } = await saveScheinselbstCheck(freelancer.id, {
      answers: { no_own_employees: true },
      note: 'Solo un indicio menor.',
      assessedBy: ADMIN_ID,
    })
    expect(error).toBeNull()
    expect(updated!.scheinselbst_check?.level).toBe('low')
    expect(updated!.scheinselbst_check?.score).toBe(1)
    expect(updated!.scheinselbst_check?.assessed_by).toBe(ADMIN_ID)

    // Snapshot survives a re-fetch (persisted, not just returned).
    const { data: after } = await fetchEntities({ includeInactive: true })
    const reread = after.find((entity) => entity.id === freelancer.id)
    expect(reread!.scheinselbst_check?.level).toBe('low')
  })
})

describe('demo compliance — GDPR right-to-erasure (Fase 6b)', () => {
  it('scrubs identifying PII and deactivates the entity', async () => {
    const { data: entities } = await fetchEntities({ includeInactive: true })
    const freelancer = entities.find((entity) => entity.kind === 'freelancer')!
    expect(freelancer.contact_email).toBeTruthy()

    const { data: erased, error } = await eraseEntityPersonalData(freelancer.id, ADMIN_ID)
    expect(error).toBeNull()
    expect(erased!.contact_email).toBeNull()
    expect(erased!.contact_phone).toBeNull()
    expect(erased!.address).toBeNull()
    expect(erased!.legal_ids).toEqual({})
    expect(erased!.scheinselbst_check).toBeNull()
    expect(erased!.is_active).toBe(false)
    expect(erased!.attributes.erased).toBe(true)
    expect(erased!.attributes.erased_by).toBe(ADMIN_ID)
    expect(erased!.display_name).toBe('[RGPD]')

    // Erasure persists — the shell stays, but the PII is gone.
    const { data: after } = await fetchEntities({ includeInactive: true })
    const reread = after.find((entity) => entity.id === freelancer.id)
    expect(reread!.contact_email).toBeNull()
    expect(reread!.attributes.erased).toBe(true)
  })
})

describe('demo compliance — hard delete of a company/freelancer', () => {
  it('reports what the deletion will take with it', async () => {
    const { data: impact, error } = await fetchEntityDeletionImpact(COMPANY_ENTITY)
    expect(error).toBeNull()
    expect(impact).toEqual({ workers: 2, documents: 9, files: 7, assignments: 1 })
  })

  it('removes the entity, its workers, checklist, versions and assignments', async () => {
    const company = { id: COMPANY_ENTITY, kind: 'company' as const }
    const { error } = await deleteEntity(company)
    expect(error).toBeNull()

    const { data: entities } = await fetchEntities({ includeInactive: true })
    expect(entities.some((entity) => entity.id === COMPANY_ENTITY)).toBe(false)
    // The two company_worker rows hung off it via parent_entity_id.
    expect(entities.some((entity) => entity.parent_entity_id === COMPANY_ENTITY)).toBe(false)

    const { data: queue } = await fetchReviewQueue()
    expect(queue.some((entry) => entry.entity.id === COMPANY_ENTITY)).toBe(false)

    const { data: assignments } = await fetchAssignedProjectIds(COMPANY_ENTITY)
    expect(assignments).toEqual([])
  })

  it('refuses kinds that are not top-level third parties', async () => {
    const { data: entities } = await fetchEntities({ includeInactive: true })
    const worker = entities.find((entity) => entity.kind === 'company_worker')!

    const { error } = await deleteEntity(worker)
    expect(error).toBeTruthy()

    const { data: after } = await fetchEntities({ includeInactive: true })
    expect(after.some((entity) => entity.id === worker.id)).toBe(true)
  })
})

describe('demo compliance — OCR field extraction (Fase 6c)', () => {
  it('extracts issue/expiry dates and the coverage amount from the OCR text', async () => {
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'police.pdf', {
      type: 'application/pdf',
    })
    const { data, error } = await extractDocumentFields(pdf)
    expect(error).toBeNull()
    expect(data!.rawText).toContain('Deckungssumme')
    expect(data!.fields).toEqual({
      issued_at: '2026-01-15',
      expires_at: '2027-01-15',
      amount: 5000000,
    })
  })

  it('rejects a non-PDF/JPEG/PNG file before calling the OCR function', async () => {
    const bogus = new File([new Uint8Array([0x00, 0x01, 0x02])], 'x.bin')
    const { error } = await extractDocumentFields(bogus)
    expect(error).toBe('file_type_not_allowed')
  })
})
