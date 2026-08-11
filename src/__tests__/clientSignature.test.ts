/// <reference types="node" />

// The client signature round-trip (plan 011 Gap C, migration 080), exercised
// against the demo store like the other *Demo suites: what these tests pass is
// also the proof that demo mode covers the new column and the storage call.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/supabase', async () => {
  const { createDemoSupabaseClient } = await import('@/lib/demo/supabase-mock')
  return { supabase: createDemoSupabaseClient(), isDemoSupabase: true }
})

import { resetStore } from '@/lib/demo/store'
import {
  clearCapturePlanCache,
  fetchCaptureReport,
  fetchClientSignatureUrl,
  removeClientSignature,
  saveCaptureReport,
  uploadClientSignature,
} from '@/services/capturePlanService'
import { INSYTE_BOHRUNG_PLAN } from '@/constants/capture-plans-insyte-bohrung'

const TECH_ID = '00000000-0000-0000-0000-000000000002'
/** The demo Insyte Bohrung order (LUM-20260429-0011). */
const WO_INSYTE = '50000000-0000-0000-0000-000000000011'

const signatureBlob = () => new Blob(['signature-bytes'], { type: 'image/png' })

beforeEach(() => {
  resetStore()
  clearCapturePlanCache()
})

describe('client signature round-trip (demo mode)', () => {
  it('stores the PNG under the order folder the 073 policies scope', async () => {
    const { path, error } = await uploadClientSignature(WO_INSYTE, signatureBlob())

    expect(error).toBeNull()
    // The first path segment is the order id — that is the whole access rule.
    expect(path).toMatch(new RegExp(`^${WO_INSYTE}/signature/client-signature-\\d+\\.png$`))
  })

  it('persists the path with the report and hands it back on load', async () => {
    const { path } = await uploadClientSignature(WO_INSYTE, signatureBlob())
    const { error } = await saveCaptureReport({
      workOrderId: WO_INSYTE,
      plan: INSYTE_BOHRUNG_PLAN,
      answers: { closing_signature: { client_signature: true } },
      userId: TECH_ID,
      clientSignaturePath: path,
    })
    expect(error).toBeNull()

    const { data: report } = await fetchCaptureReport(WO_INSYTE)
    expect(report?.client_signature_path).toBe(path)
    expect(report?.answers).toEqual({ closing_signature: { client_signature: true } })
  })

  it('leaves the stored path alone when the save does not mention it', async () => {
    const { path } = await uploadClientSignature(WO_INSYTE, signatureBlob())
    await saveCaptureReport({
      workOrderId: WO_INSYTE,
      plan: INSYTE_BOHRUNG_PLAN,
      answers: { closing_signature: { client_signature: true } },
      userId: TECH_ID,
      clientSignaturePath: path,
    })

    // e.g. the offline queue replaying a draft that predates the signature.
    await saveCaptureReport({
      workOrderId: WO_INSYTE,
      plan: INSYTE_BOHRUNG_PLAN,
      answers: { closing_signature: { client_signature: true }, nt_ta: { ta_installed: true } },
      userId: TECH_ID,
    })

    const { data: report } = await fetchCaptureReport(WO_INSYTE)
    expect(report?.client_signature_path).toBe(path)
  })

  it('clears the path when the technician withdraws the signature', async () => {
    const { path } = await uploadClientSignature(WO_INSYTE, signatureBlob())
    await saveCaptureReport({
      workOrderId: WO_INSYTE,
      plan: INSYTE_BOHRUNG_PLAN,
      answers: { closing_signature: { client_signature: true } },
      userId: TECH_ID,
      clientSignaturePath: path,
    })

    await removeClientSignature(path!)
    await saveCaptureReport({
      workOrderId: WO_INSYTE,
      plan: INSYTE_BOHRUNG_PLAN,
      answers: { closing_signature: { client_signature: null } },
      userId: TECH_ID,
      clientSignaturePath: null,
    })

    const { data: report } = await fetchCaptureReport(WO_INSYTE)
    expect(report?.client_signature_path).toBeNull()
  })

  it('serves a URL for the stored image (placeholder in demo)', async () => {
    const { path } = await uploadClientSignature(WO_INSYTE, signatureBlob())
    const url = await fetchClientSignatureUrl(path!)
    expect(url).toEqual(expect.any(String))
    expect(url!.length).toBeGreaterThan(0)
  })
})

describe('migration 080 — the signature column', () => {
  const migration080 = readFileSync(
    join(process.cwd(), 'supabase', 'migrations', '080_client_signature.sql'),
    'utf8',
  )

  it('adds the column to the capture report and declares its dependencies', () => {
    const sql = migration080.toLowerCase()
    expect(sql).toMatch(/--\s*depends on:[\s\S]*052_capture_plans\.sql/)
    expect(sql).toMatch(/--\s*depends on:[\s\S]*073_work_order_access_scope\.sql/)
    expect(sql).toMatch(
      /alter table public\.work_order_capture_reports\s+add column if not exists client_signature_path text null/,
    )
  })

  it('touches no storage DDL — the 073 path scoping is the whole access rule', () => {
    // The signature reuses <orderId>/signature/ inside work-order-photos, so
    // neither DDL source (migrations, rls_policies.sql) changes. A storage
    // statement appearing here would mean the two sources can drift again.
    const sql = migration080.toLowerCase()
    expect(sql).not.toContain('storage.objects')
    expect(sql).not.toContain('storage.buckets')
    expect(sql).not.toContain('create policy')
  })
})
