export const UserRole = {
  ADMIN: 'admin',
  TECHNICIAN: 'technician',
  CONTRACTOR: 'contractor',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const TeamColor = {
  ROT: 'rot',
  GRUEN: 'gruen',
  BLAU: 'blau',
  GELB: 'gelb',
} as const

export type TeamColor = (typeof TeamColor)[keyof typeof TeamColor]

export const WorkOrderStatus = {
  CREATED: 'created',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  EXECUTED: 'executed',
  RUECKMELDUNG_PENDING: 'rueckmeldung_pending',
  RUECKMELDUNG_SENT: 'rueckmeldung_sent',
  INTERNALLY_CERTIFIED: 'internally_certified',
  SENT_TO_CLIENT: 'sent_to_client',
  CLIENT_ACCEPTED: 'client_accepted',
  CLIENT_REJECTED: 'client_rejected',
  INVOICED: 'invoiced',
  PAID: 'paid',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
} as const

export type WorkOrderStatus = (typeof WorkOrderStatus)[keyof typeof WorkOrderStatus]

export const WorkType = {
  SOPLADO: 'soplado',
  FUSION_AP: 'fusion_ap',
  FUSION_DP: 'fusion_dp',
  ALTA: 'alta',
  NT_INSTALLATION: 'nt_installation',
  PATCHKABEL: 'patchkabel',
} as const

export type WorkType = (typeof WorkType)[keyof typeof WorkType]
