// Order attachments for the field (plan 011 Gap D), exercised against the
// demo store like the other *Demo suites: what these tests pass is also the
// proof that demo mode covers the technician's read-only attachment list.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createDemoSupabaseClient } = await import('@/lib/demo/supabase-mock')
  return { supabase: createDemoSupabaseClient(), isDemoSupabase: true }
})

import { resetStore } from '@/lib/demo/store'
import {
  fetchWorkOrderDocuments,
  getDocumentSignedUrls,
  uploadWorkOrderDocument,
} from '@/services/workOrderDocumentService'
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_DOCUMENT_MIME_TYPES,
} from '@/types/work-order-documents'

const ADMIN_ID = '00000000-0000-0000-0000-000000000001'
/** The demo Insyte Bohrung order (LUM-20260429-0011). */
const WO_INSYTE = '50000000-0000-0000-0000-000000000011'

beforeEach(() => {
  resetStore()
})

describe('document types accept order context in any of the three shapes', () => {
  // Owner request (plan 011 Gap D): image, PDF or Excel as extra order info,
  // for EVERY document type — images used to be a diagrama_routing privilege.
  it('allows pdf, excel and images for every document type', () => {
    expect(ALLOWED_DOCUMENT_MIME_TYPES).toEqual([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'image/png',
      'image/jpeg',
    ])
    expect(ALLOWED_DOCUMENT_EXTENSIONS).toEqual([
      '.pdf',
      '.xlsx',
      '.xls',
      '.png',
      '.jpg',
      '.jpeg',
    ])
  })
})

describe('order attachments in demo mode', () => {
  it('lists the files attached to the demo Insyte order, newest first', async () => {
    const { data, error } = await fetchWorkOrderDocuments(WO_INSYTE)

    expect(error).toBeNull()
    expect(data.map((doc) => doc.file_name)).toEqual([
      'HUEP_Zugang_Foto.png',
      'Trassenplan_Brenkhaeuser_14.pdf',
    ])
    expect(data.every((doc) => doc.work_order_id === WO_INSYTE)).toBe(true)
  })

  it('serves a URL per attachment (placeholder in demo)', async () => {
    const { data } = await fetchWorkOrderDocuments(WO_INSYTE)
    const urls = await getDocumentSignedUrls(data.map((doc) => doc.storage_path))

    for (const doc of data) {
      expect(urls[doc.storage_path]).toEqual(expect.any(String))
    }
  })

  it('accepts an image upload for a non-diagram type', async () => {
    const file = new File(['png-bytes'], 'site-access.png', { type: 'image/png' })
    const { data, error } = await uploadWorkOrderDocument(WO_INSYTE, 'plano', file, ADMIN_ID)

    expect(error).toBeNull()
    expect(data?.mime_type).toBe('image/png')
    expect(data?.storage_path).toMatch(new RegExp(`^${WO_INSYTE}/\\d+-site-access\\.png$`))

    const { data: listed } = await fetchWorkOrderDocuments(WO_INSYTE)
    expect(listed.some((doc) => doc.file_name === 'site-access.png')).toBe(true)
  })

  it('refuses a file type the catalog does not allow, at the service door', async () => {
    const file = new File(['<svg/>'], 'diagram.svg', { type: 'image/svg+xml' })
    const { data, error } = await uploadWorkOrderDocument(WO_INSYTE, 'other', file, ADMIN_ID)

    expect(data).toBeNull()
    expect(error).toContain('diagram.svg')

    const { data: listed } = await fetchWorkOrderDocuments(WO_INSYTE)
    expect(listed.some((doc) => doc.file_name === 'diagram.svg')).toBe(false)
  })
})
