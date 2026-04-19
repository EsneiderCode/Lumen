import type { WorkOrderStatus, TeamColor } from '@/types/enums'

export const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  created: 'bg-fg-2/20 text-fg-2',
  assigned: 'bg-accent/15 text-accent',
  in_progress: 'bg-info/15 text-info',
  executed: 'bg-warn/15 text-warn',
  rueckmeldung_pending: 'bg-warn/20 text-warn',
  rueckmeldung_sent: 'bg-warn/10 text-warn',
  internally_certified: 'bg-ok/15 text-ok',
  sent_to_client: 'bg-info/10 text-info',
  client_accepted: 'bg-ok/20 text-ok',
  client_rejected: 'bg-err/15 text-err',
  invoiced: 'bg-info/10 text-info',
  paid: 'bg-ok/25 text-ok',
  returned: 'bg-warn/15 text-warn',
  cancelled: 'bg-err/10 text-err',
}

export const TEAM_DOT: Record<TeamColor, string> = {
  rot: 'bg-team-rot',
  gruen: 'bg-team-gruen',
  blau: 'bg-team-blau',
  gelb: 'bg-team-gelb',
}

export const PRIORITY_COLORS: Record<'normal' | 'alta' | 'urgente', string> = {
  normal: 'text-fg-2',
  alta: 'text-warn',
  urgente: 'text-err',
}

export const TEAMS: { value: TeamColor; label: string; dot: string }[] = [
  { value: 'rot', label: 'Team Rot', dot: 'bg-team-rot' },
  { value: 'gruen', label: 'Team Grün', dot: 'bg-team-gruen' },
  { value: 'blau', label: 'Team Blau', dot: 'bg-team-blau' },
  { value: 'gelb', label: 'Team Gelb', dot: 'bg-team-gelb' },
]
