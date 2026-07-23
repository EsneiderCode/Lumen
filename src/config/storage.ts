export const STORAGE_BUCKETS = {
  WORK_ORDER_PHOTOS: 'work-order-photos',
  // Legacy bucket. The old contractor-documents UI was retired (Fase 2); the
  // bucket is kept because pre-migration files still live here and are served
  // via document_versions.storage_bucket. New uploads go to COMPLIANCE_DOCUMENTS.
  CONTRACTOR_DOCUMENTS: 'contractor-documents',
  COMPLIANCE_DOCUMENTS: 'compliance-documents',
  CERTIFICATION_PDFS: 'certification-pdfs',
  PAYROLL_PDFS: 'payroll-pdfs',
} as const
