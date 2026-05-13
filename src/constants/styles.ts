import type { WorkOrderStatus, TeamColor } from '@/types/enums'

export const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  created: 'badge-neutral',
  assigned: 'badge-info',
  in_progress: 'badge-info',
  executed: 'badge-warn',
  rueckmeldung_pending: 'badge-warn',
  rueckmeldung_sent: 'badge-warn',
  internally_certified: 'badge-ok',
  sent_to_client: 'badge-info',
  client_accepted: 'badge-ok',
  client_rejected: 'badge-err',
  invoiced: 'badge-info',
  paid: 'badge-ok',
  returned: 'badge-warn',
  cancelled: 'badge-err',
}

export const TEAM_DOT: Record<TeamColor, string> = {
  rot: 'bg-team-rot',
  gruen: 'bg-team-gruen',
  blau: 'bg-team-blau',
  gelb: 'bg-team-gelb',
}

export const PRIORITY_COLORS: Record<'normal' | 'alta' | 'urgente', string> = {
  normal: 'badge-neutral',
  alta: 'badge-warn',
  urgente: 'badge-err',
}

export const TEAMS: { value: TeamColor; label: string; dot: string }[] = [
  { value: 'rot', label: 'Team Rot', dot: 'bg-team-rot' },
  { value: 'gruen', label: 'Team Grün', dot: 'bg-team-gruen' },
  { value: 'blau', label: 'Team Blau', dot: 'bg-team-blau' },
  { value: 'gelb', label: 'Team Gelb', dot: 'bg-team-gelb' },
]
