import { useLabels } from '@/i18n/labels'
import { TEAM_DOT } from '@/constants/styles'
import type { TeamColor } from '@/types/enums'

interface Props {
  team: TeamColor
  showLabel?: boolean
  className?: string
}

export function TeamDot({ team, showLabel = false, className = '' }: Props) {
  const L = useLabels()
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className={`h-2 w-2 rounded-full ${TEAM_DOT[team]}`} />
      {showLabel && <span className="text-fg-1">{L.team(team)}</span>}
    </div>
  )
}
