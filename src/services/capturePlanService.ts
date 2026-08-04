// Supabase access for capture plans, capture reports and slot-aware photos.
//
// The plan catalog and the answers blob live in the tables added by migrations
// 052 and 053, both applied and present in database.types.ts.

import { supabase } from '@/lib/supabase'
import { scalePhotoForUpload } from '@/lib/photoScaling'
// Type-only: workOrderService imports this module, so a value import here would
// close a cycle. Callers normalize the raw column themselves, as they already do.
import type { ReportedServiceItemDraft } from '@/services/workOrderService'
import {
  capturePlanKeyForOrder,
  capturePlanWorkType,
  compiledVariantsForWorkType,
  defaultCapturePlanFor,
} from '@/constants/capture-plans'
import type {
  CaptureAnswers,
  CaptureGeoPoint,
  CapturePlan,
  CapturedPhotoRef,
  LegacyPhotoType,
} from '@/types/capture-plan'
import type { Database, Json } from '@/types/database.types'

type CaptureReportInsert = Database['public']['Tables']['work_order_capture_reports']['Insert']

/**
 * Plans change about never, and the technician screen asks for one on every
 * open. An in-process cache keeps that to one round trip per session. The
 * offline (IndexedDB) cache lands in phase 6; the compiled defaults already
 * cover the case where the request fails.
 */
const planCache = new Map<string, CapturePlan>()

export function clearCapturePlanCache() {
  planCache.clear()
}

function isPlan(value: unknown): value is CapturePlan {
  if (!value || typeof value !== 'object') return false
  const plan = value as CapturePlan
  return typeof plan.key === 'string' && Array.isArray(plan.sections)
}

/**
 * Highest active version of a plan, falling back to the compiled default.
 * Returns null only for a key that exists in neither — a work order pointing at
 * a plan nobody seeded, which the caller must surface rather than silently
 * render an empty form.
 */
export async function fetchCapturePlan(planKey: string): Promise<CapturePlan | null> {
  const cached = planCache.get(planKey)
  if (cached) return cached

  const { data } = await supabase
    .from('capture_plans')
    .select('definition')
    .eq('key', planKey)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)

  const plan = isPlan(data?.[0]?.definition) ? data[0].definition : defaultCapturePlanFor(planKey)
  if (plan) planCache.set(planKey, plan)
  return plan
}

/**
 * One exact version of a plan — what a capture report is pinned to, and what the
 * certification gate (054) evaluates, so a stricter plan published later cannot
 * invalidate a Rückmeldung already sent. Returns null when that version is gone
 * from the catalog; the caller then falls back to the current one.
 */
export async function fetchCapturePlanVersion(
  planKey: string,
  version: number,
): Promise<CapturePlan | null> {
  const { data } = await supabase
    .from('capture_plans')
    .select('definition')
    .eq('key', planKey)
    .eq('version', version)
    .limit(1)

  return isPlan(data?.[0]?.definition) ? data[0].definition : null
}

/** The plan a work order is captured under. Mirrors `work_order_capture_plan_key()`. */
export function fetchCapturePlanForOrder(order: {
  work_type: string
  capture_plan_key?: string | null
}): Promise<CapturePlan | null> {
  return fetchCapturePlan(capturePlanKeyForOrder(order))
}

/**
 * The plan variants an admin can put on an order of this work type, newest
 * version of each key. Falls back to the compiled variants when the catalog is
 * unreachable (or migration 052/053 not applied yet) — an admin must not lose
 * the ability to pick "Soplado de RA" because a request failed.
 */
export async function fetchCapturePlanVariants(workType: string): Promise<CapturePlan[]> {
  const { data } = await supabase
    .from('capture_plans')
    .select('definition, version')
    .eq('is_active', true)
    .order('version', { ascending: true })

  const newestByKey = new Map<string, CapturePlan>()
  for (const row of data ?? []) {
    // Ordered ascending, so a later row is a newer version of the same key.
    if (isPlan(row.definition)) newestByKey.set(row.definition.key, row.definition)
  }

  const variants = [...newestByKey.values()].filter(
    (plan) => capturePlanWorkType(plan) === workType && plan.key !== workType,
  )
  return variants.length > 0 ? variants : compiledVariantsForWorkType(workType)
}

// ── Example photos ───────────────────────────────────────────────────────────

/**
 * Signed URLs for the example thumbnails, keyed by the slot's `example` path.
 * A missing object is simply absent from the map: the slot then renders without
 * its example instead of breaking the form.
 */
export async function fetchCaptureExampleUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage
    .from('capture-examples')
    .createSignedUrls(paths, 3600)
  if (error || !data) return {}
  return Object.fromEntries(
    data.filter((item) => item.signedUrl && !item.error).map((item) => [item.path, item.signedUrl]),
  )
}

export interface CaptureReport {
  work_order_id: string
  plan_key: string
  plan_version: number
  answers: CaptureAnswers
  /**
   * Catalogued services actually performed (alta orders). It sits beside the
   * answers rather than inside them because no plan declares it and none should
   * — it is a list of catalog references with quantities, and it is what the
   * admin bills from. Moved here from wo_detail_alta by migration 055.
   */
  reported_service_items: ReportedServiceItemDraft[]
  submitted_at: string | null
}

export async function fetchCaptureReport(
  workOrderId: string,
): Promise<{ data: CaptureReport | null; error: string | null }> {
  const { data, error } = await supabase
    .from('work_order_capture_reports')
    .select('*')
    .eq('work_order_id', workOrderId)
    .limit(1)

  const row = (data as CaptureReport[] | null)?.[0] ?? null
  return { data: row, error: error?.message ?? null }
}

export async function saveCaptureReport(params: {
  workOrderId: string
  /** Only the identity is stored; the offline queue replays it without the sections. */
  plan: Pick<CapturePlan, 'key' | 'version'>
  answers: CaptureAnswers
  userId: string
  submitted?: boolean
  /** Alta orders only; left alone when omitted. */
  reportedServiceItems?: ReportedServiceItemDraft[]
}): Promise<{ error: string | null; errorCode: string | null }> {
  const { workOrderId, plan, answers, userId, submitted, reportedServiceItems } = params

  const payload: CaptureReportInsert = {
    work_order_id: workOrderId,
    plan_key: plan.key,
    plan_version: plan.version,
    // The blob is the plan's own shape, which JSONB takes verbatim.
    answers: answers as Json,
    updated_by: userId,
  }
  // The double cast is structural, not a missing type: an interface has no index
  // signature, so TS will not accept it as Json even though the shape is valid.
  if (reportedServiceItems) payload.reported_service_items = reportedServiceItems as unknown as Json
  if (submitted) payload.submitted_at = new Date().toISOString()

  const { error } = await supabase
    .from('work_order_capture_reports')
    .upsert(payload, { onConflict: 'work_order_id' })

  return { error: error?.message ?? null, errorCode: error?.code ?? null }
}

export interface CapturePhotoRow extends CapturedPhotoRef {
  storage_path: string
  caption: string | null
  created_at?: string
}

export interface UploadCapturePhotoParams {
  workOrderId: string
  file: File
  userId: string
  sectionKey: string
  slotKey: string
  legacyType: LegacyPhotoType
  itemId?: string | null
  location?: CaptureGeoPoint | null
  takenAt?: string
  /**
   * Skips the client-side rescale. Set by the offline queue, whose blobs were
   * already scaled before being stored — re-encoding them would only lose
   * quality and time.
   */
  skipScaling?: boolean
}

/**
 * Uploads one photo stamped with the slot it belongs to. `photo_type` is still
 * written from the slot's legacyType so the PDF, the admin detail view and the
 * current certification gate keep working while the plans roll out.
 */
export async function uploadCapturePhoto(
  params: UploadCapturePhotoParams,
): Promise<{ data: CapturePhotoRow | null; error: string | null }> {
  const {
    workOrderId,
    file,
    userId,
    sectionKey,
    slotKey,
    legacyType,
    itemId,
    location,
    takenAt,
    skipScaling,
  } = params

  const upload = skipScaling ? file : (await scalePhotoForUpload(file)).file
  const ext = upload.name.split('.').pop() ?? 'jpg'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const storagePath = `${workOrderId}/${sectionKey}/${slotKey}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from('work-order-photos')
    .upload(storagePath, upload, { contentType: upload.type })
  if (uploadError) return { data: null, error: uploadError.message }

  const { data, error } = await supabase
    .from('work_order_photos')
    .insert({
      work_order_id: workOrderId,
      storage_path: storagePath,
      photo_type: legacyType,
      uploaded_by: userId,
      section_key: sectionKey,
      slot_key: slotKey,
      item_id: itemId ?? null,
      taken_at: takenAt ?? new Date().toISOString(),
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      accuracy_m: location?.accuracy_m ?? null,
    })
    .select()
    .single()

  return { data: (data as CapturePhotoRow | null) ?? null, error: error?.message ?? null }
}
