import { TEAM_DOT } from '@/constants/styles'
import { TEAM_LABELS } from '@/constants/labels'
import type { TeamColor } from '@/types/enums'

interface Props {
  team: TeamColor
  showLabel?: boolean
  className?: string
}

export function TeamDot({ team, showLabel = false, className = '' }: Props) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className={`h-2 w-2 rounded-full ${TEAM_DOT[team]}`} />
      {showLabel && <span className="text-gf-text">{TEAM_LABELS[team]}</span>}
    </div>
  )
}
