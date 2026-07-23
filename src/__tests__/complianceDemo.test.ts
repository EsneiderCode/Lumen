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
  fetchChecklist,
  fetchEntityByProfileId,
  fetchProfileCompliance,
  fetchRequirements,
  fetchReviewQueue,
} from '@/services/complianceService'

const CONTRACTOR_ID = '00000000-0000-0000-0000-000000000003'
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
