export type WorkOrderActionErrorCode =
  | 'invalid_transition'
  | 'permission_denied'
  | 'contractor_not_compliant'
  | 'incomplete_rueckmeldung'
  | 'missing_required_photos'
  | 'missing_internal_audit'
  | 'missing_client_audit'
  | 'not_client_backed'
  | 'not_direct_order'
  | 'not_found'
  | 'server_error'

export interface WorkOrderActionReason {
  code: WorkOrderActionErrorCode
  message: string
  requirementId?: string
  field?: string
}

export interface WorkOrderActionResult<T = unknown> {
  ok: boolean
  data: T | null
  reasons: WorkOrderActionReason[]
}

export function toSuccessResult<T>(data: T): WorkOrderActionResult<T> {
  return { ok: true, data, reasons: [] }
}

export function toFailureResult<T = unknown>(
  reasons: WorkOrderActionReason[],
): WorkOrderActionResult<T> {
  return { ok: false, data: null, reasons }
}

export function isDirectWorkOrder(order: {
  client_id: string | null
  [key: string]: unknown
}): boolean {
  return order.client_id === null
}

export function reasonsToMessage(reasons: WorkOrderActionReason[]): string {
  return reasons.map((reason) => reason.message).join('; ')
}
