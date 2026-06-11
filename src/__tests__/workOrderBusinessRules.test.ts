import { describe, expect, it } from 'vitest'
import {
  buildContractorDocumentFailureReasons,
  buildPersonAssignmentFailureReasons,
  isDirectWorkOrder,
  toFailureResult,
  type WorkOrderActionReason,
} from '@/services/workOrderBusinessRules'
import type { ContractorDocument, ContractorDocumentType } from '@/types/contractor-documents'
import { REQUIRED_CONTRACTOR_DOCUMENT_TYPES } from '@/types/contractor-documents'

const baseDoc = (overrides: Partial<ContractorDocument>): ContractorDocument => ({
  id: `doc-${overrides.document_type ?? 'unknown'}`,
  contractor_id: 'contractor-1',
  document_type: 'gewerbeanmeldung',
  status: 'approved',
  file_name: 'doc.pdf',
  storage_path: 'contractor-1/doc.pdf',
  mime_type: 'application/pdf',
  size_bytes: 100,
  issued_at: '2026-01-01',
  expires_at: null,
  uploaded_by: 'admin-1',
  uploaded_at: '2026-01-01T00:00:00Z',
  reviewed_by: 'admin-1',
  reviewed_at: '2026-01-02T00:00:00Z',
  review_notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  ...overrides,
})

describe('isDirectWorkOrder', () => {
  it('classifies an order as direct only when client_id is null', () => {
    expect(isDirectWorkOrder({ client_id: null, assigned_collaborator_id: 'contractor-1' })).toBe(
      true,
    )
  })

  it('classifies an order with a client as client-backed regardless of collaborator assignment', () => {
    expect(
      isDirectWorkOrder({ client_id: 'client-1', assigned_collaborator_id: 'contractor-1' }),
    ).toBe(false)
  })
})

describe('buildContractorDocumentFailureReasons', () => {
  it('reports all missing contractor document requirements together', () => {
    const reasons = buildContractorDocumentFailureReasons([], '2026-05-15')

    expect(reasons).toHaveLength(6)
    expect(reasons.map((reason) => reason.code)).toEqual(
      Array(6).fill('contractor_documents_missing'),
    )
    expect(reasons.map((reason) => reason.requirementId)).toContain(
      'contractor_document:gewerbeanmeldung',
    )
    expect(reasons.map((reason) => reason.documentType)).toContain('subcontractor_agreement')
  })

  it('distinguishes unapproved and expired documents while preserving all failures', () => {
    const reasons = buildContractorDocumentFailureReasons(
      [
        baseDoc({ document_type: 'gewerbeanmeldung', status: 'approved' }),
        baseDoc({ document_type: 'haftpflichtversicherung', status: 'pending_review' }),
        baseDoc({
          document_type: 'unbedenklichkeit_finanzamt',
          status: 'approved',
          expires_at: '2026-05-14',
        }),
        baseDoc({ document_type: 'id_passport', status: 'approved', expires_at: '2030-01-01' }),
        baseDoc({ document_type: 'subcontractor_agreement', status: 'approved' }),
      ],
      '2026-05-15',
    )

    expect(reasons).toEqual(
      expect.arrayContaining<WorkOrderActionReason>([
        expect.objectContaining({
          code: 'contractor_documents_unapproved',
          documentType: 'haftpflichtversicherung',
          requirementId: 'contractor_document:haftpflichtversicherung',
        }),
        expect.objectContaining({
          code: 'contractor_documents_expired',
          documentType: 'unbedenklichkeit_finanzamt',
          requirementId: 'contractor_document:unbedenklichkeit_finanzamt',
        }),
        expect.objectContaining({
          code: 'contractor_documents_missing',
          documentType: 'unbedenklichkeit_sozialkasse',
          requirementId: 'contractor_document:unbedenklichkeit_sozialkasse',
        }),
      ]),
    )
    expect(reasons).toHaveLength(3)
  })
})


const validContractorDocs = (): ContractorDocument[] =>
  REQUIRED_CONTRACTOR_DOCUMENT_TYPES.map((documentType: ContractorDocumentType) =>
    baseDoc({ document_type: documentType, status: 'approved', expires_at: '2030-01-01' }),
  )

describe('buildPersonAssignmentFailureReasons', () => {
  it('allows internal technicians regardless of contractor documents', () => {
    expect(
      buildPersonAssignmentFailureReasons(
        { id: 'tech-1', role: 'technician' },
        [],
        '2026-05-15',
      ),
    ).toEqual([])
  })

  it('allows contractors when every required document is approved and valid', () => {
    expect(
      buildPersonAssignmentFailureReasons(
        { id: 'contractor-1', role: 'contractor' },
        validContractorDocs(),
        '2026-05-15',
      ),
    ).toEqual([])
  })

  it('blocks contractors with missing or expired documents', () => {
    const reasons = buildPersonAssignmentFailureReasons(
      { id: 'contractor-1', role: 'contractor' },
      [
        baseDoc({ document_type: 'gewerbeanmeldung', status: 'approved' }),
        baseDoc({
          document_type: 'haftpflichtversicherung',
          status: 'approved',
          expires_at: '2026-05-14',
        }),
      ],
      '2026-05-15',
    )

    expect(reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'contractor_documents_expired' }),
        expect.objectContaining({ code: 'contractor_documents_missing' }),
      ]),
    )
  })
})

describe('toFailureResult', () => {
  it('wraps structured reasons in a deterministic action result', () => {
    const reasons: WorkOrderActionReason[] = [
      { code: 'missing_client_audit', message: 'Kundenakzeptanz fehlt' },
    ]

    expect(toFailureResult(reasons)).toEqual({ ok: false, data: null, reasons })
  })
})
