import type { WorkOrderStatus, TeamColor } from '@/types/enums'

export const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  created: 'bg-gf-text-muted/20 text-gf-text-muted',
  assigned: 'bg-gf-primary/15 text-gf-primary-dark',
  in_progress: 'bg-gf-accent/15 text-gf-accent',
  executed: 'bg-gf-warning/15 text-amber-700',
  rueckmeldung_pending: 'bg-gf-warning/20 text-amber-700',
  rueckmeldung_sent: 'bg-gf-warning/10 text-amber-600',
  internally_certified: 'bg-gf-success/15 text-emerald-700',
  sent_to_client: 'bg-gf-primary/10 text-gf-primary-dark',
  client_accepted: 'bg-gf-success/20 text-emerald-700',
  client_rejected: 'bg-gf-danger/15 text-rose-700',
  invoiced: 'bg-gf-accent/10 text-purple-700',
  paid: 'bg-gf-success/25 text-emerald-800',
  returned: 'bg-gf-warning/15 text-amber-700',
  cancelled: 'bg-gf-danger/10 text-rose-600',
}

export const TEAM_DOT: Record<TeamColor, string> = {
  rot: 'bg-team-rot',
  gruen: 'bg-team-gruen',
  blau: 'bg-team-blau',
  gelb: 'bg-team-gelb',
}

export const PRIORITY_COLORS: Record<'normal' | 'alta' | 'urgente', string> = {
  normal: 'text-gf-text-muted',
  alta: 'text-gf-warning',
  urgente: 'text-gf-danger',
}

export const TEAMS: { value: TeamColor; label: string; dot: string }[] = [
  { value: 'rot', label: 'Team Rot', dot: 'bg-team-rot' },
  { value: 'gruen', label: 'Team Grün', dot: 'bg-team-gruen' },
  { value: 'blau', label: 'Team Blau', dot: 'bg-team-blau' },
  { value: 'gelb', label: 'Team Gelb', dot: 'bg-team-gelb' },
]
