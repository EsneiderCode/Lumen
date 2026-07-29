import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import type { WorkOrderStatus, WorkType, TeamColor } from '@/types/enums'
import {
  orderTypeLabel,
  SEGMENT_KINDS,
  type OrderTypeLabelSource,
  type SegmentKind,
} from '@/lib/orderSiteRef'

type Priority = 'normal' | 'alta' | 'urgente'
type PhotoType = 'before' | 'during' | 'after'

// Canonical enum orderings — single source of truth for iteration
// (dropdown options, filter lists, tab bars, etc.)
export const STATUS_KEYS: readonly WorkOrderStatus[] = [
  'created', 'assigned', 'in_progress', 'executed',
  'rueckmeldung_pending', 'rueckmeldung_sent',
  'internally_certified', 'sent_to_client',
  'client_accepted', 'client_rejected',
  'invoiced', 'paid', 'returned', 'cancelled',
] as const

export const WORK_TYPE_KEYS: readonly WorkType[] = [
  'soplado', 'fusion_ap', 'fusion_dp', 'alta', 'nt_installation', 'patchkabel', 'pop',
] as const

export const PRIORITY_KEYS: readonly Priority[] = ['normal', 'alta', 'urgente'] as const

export const TEAM_COLOR_KEYS: readonly TeamColor[] = [
  'rot', 'gruen', 'blau', 'gelb', 'weiss', 'grau',
  'braun', 'violett', 'tuerkis', 'schwarz', 'orange', 'rosa',
] as const

export const PHOTO_TYPE_KEYS: readonly PhotoType[] = ['before', 'during', 'after'] as const

// Status groups matching the AdminDashboard KPI buckets
export const STATUS_GROUPS = {
  open: ['created', 'assigned'] as WorkOrderStatus[],
  inProgress: ['in_progress', 'executed', 'rueckmeldung_pending'] as WorkOrderStatus[],
  pendingCert: ['rueckmeldung_sent', 'internally_certified', 'sent_to_client'] as WorkOrderStatus[],
  done: ['client_accepted', 'invoiced', 'paid'] as WorkOrderStatus[],
  attention: ['returned', 'client_rejected'] as WorkOrderStatus[],
} as const

/**
 * React hook: translated labels for enum-like fields.
 * Use inside components. For service/non-React contexts, use the
 * non-hook `labels` singleton below.
 */
export function useLabels() {
  const { t } = useTranslation()
  return {
    status:      (s: WorkOrderStatus) => t(`status.${s}`),
    workType:    (w: WorkType)        => t(`workType.${w}`),
    segmentKind: (s: SegmentKind)     => t(`segmentKind.${s}`),
    priority:    (p: Priority)        => t(`priority.${p}`),
    team:        (c: TeamColor)       => t(`teamColor.${c}`),
    detailField: (k: string)          => t(`detailField.${k}`, { defaultValue: k.replace(/_/g, ' ') }),
    photo:       (p: PhotoType)       => t(`photo.${p}`),
    /** «Soplado RA» — el tipo con su tramo, que es lo que distingue una orden de otra. */
    orderType:   (o: OrderTypeLabelSource & { work_type: WorkType }) =>
      orderTypeLabel(o, t(`workType.${o.work_type}`), (s) => t(`segmentKind.${s}`)),
    // Options helpers for dropdowns / filter lists
    statusOptions:   () => STATUS_KEYS.map((v) => ({ value: v, label: t(`status.${v}`) })),
    statusGroupOptions: () => [
      { value: 'open',        statuses: STATUS_GROUPS.open,        label: t('statusGroup.open') },
      { value: 'inProgress',  statuses: STATUS_GROUPS.inProgress,  label: t('statusGroup.inProgress') },
      { value: 'pendingCert', statuses: STATUS_GROUPS.pendingCert, label: t('statusGroup.pendingCert') },
      { value: 'done',        statuses: STATUS_GROUPS.done,        label: t('statusGroup.done') },
      { value: 'attention',   statuses: STATUS_GROUPS.attention,   label: t('statusGroup.attention') },
    ],
    workTypeOptions: () => WORK_TYPE_KEYS.map((v) => ({ value: v, label: t(`workType.${v}`) })),
    segmentKindOptions: () => SEGMENT_KINDS.map((v) => ({
      value: v,
      label: t(`segmentKind.${v}`),
      hint: t(`segmentKindLong.${v}`),
    })),
    priorityOptions: () => PRIORITY_KEYS.map((v) => ({ value: v, label: t(`priority.${v}`) })),
    teamOptions:     () => TEAM_COLOR_KEYS.map((v) => ({ value: v, label: t(`teamColor.${v}`) })),
  }
}

/**
 * Non-hook access for service layer / PDF generation / anywhere outside
 * the React tree. Uses the global i18n singleton — respects the user's
 * current language at call time.
 */
export const labels = {
  status:      (s: WorkOrderStatus) => i18n.t(`status.${s}`),
  workType:    (w: WorkType)        => i18n.t(`workType.${w}`),
  segmentKind: (s: SegmentKind)     => i18n.t(`segmentKind.${s}`),
  orderType:   (o: OrderTypeLabelSource & { work_type: WorkType }) =>
    orderTypeLabel(o, i18n.t(`workType.${o.work_type}`), (s) => i18n.t(`segmentKind.${s}`)),
  priority:    (p: Priority)        => i18n.t(`priority.${p}`),
  team:        (c: TeamColor)       => i18n.t(`teamColor.${c}`),
  detailField: (k: string)          => i18n.t(`detailField.${k}`, { defaultValue: k.replace(/_/g, ' ') }),
  photo:       (p: PhotoType)       => i18n.t(`photo.${p}`),
}
