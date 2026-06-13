import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  CYCLE_MILESTONES,
  CYCLE_MILESTONE_ORDER,
  type CycleMilestoneType,
} from '@/config/cycleMilestones'
import { reviewEndDate } from '@/lib/businessDays'
import type { CollaboratorCycle } from '@/services/collaboratorCyclesService'

/** A single calendar day with the milestone conventions that land on it. */
interface DayMarks {
  iso: string
  day: number
  inMonth: boolean
  milestones: CycleMilestoneType[]
}

function isoOf(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/** Expand a cycle into the set of ISO days each milestone occupies. */
function cycleMilestoneDays(cycle: CollaboratorCycle): Map<string, Set<CycleMilestoneType>> {
  const map = new Map<string, Set<CycleMilestoneType>>()
  const add = (iso: string | null, type: CycleMilestoneType) => {
    if (!iso) return
    if (!map.has(iso)) map.set(iso, new Set())
    map.get(iso)!.add(type)
  }

  add(cycle.emission_date, 'emission')
  add(cycle.final_cert_date, 'final_cert')
  add(cycle.payment_date, 'payment')

  // Review window: start .. start + 3 business days, inclusive of both ends.
  // The band spans weekends but they are not review days, so skip Sat/Sun.
  if (cycle.review_start_date) {
    const end = reviewEndDate(cycle.review_start_date)
    let cursor = cycle.review_start_date
    const isWeekend = (iso: string) => {
      const dow = new Date(`${iso}T00:00:00Z`).getUTCDay()
      return dow === 0 || dow === 6
    }
    if (!isWeekend(cursor)) add(cursor, 'review')
    while (end && cursor < end) {
      const d = new Date(`${cursor}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + 1)
      cursor = d.toISOString().slice(0, 10)
      if (!isWeekend(cursor)) add(cursor, 'review')
    }
  }

  return map
}

interface Props {
  cycles: CollaboratorCycle[]
  /** Month to open on (ISO). Defaults to the earliest milestone or today. */
  initialMonth?: string
}

/**
 * Lightweight read-only month-grid calendar. No external date library — pure
 * date math. Marks each published milestone day with its NEXUS convention dot.
 */
export function CycleCalendar({ cycles, initialMonth }: Props) {
  const { t, i18n } = useTranslation()

  const allDays = useMemo(() => {
    const merged = new Map<string, Set<CycleMilestoneType>>()
    for (const cycle of cycles) {
      for (const [iso, types] of cycleMilestoneDays(cycle)) {
        if (!merged.has(iso)) merged.set(iso, new Set())
        for (const ty of types) merged.get(iso)!.add(ty)
      }
    }
    return merged
  }, [cycles])

  const firstMarked = useMemo(() => {
    const isos = [...allDays.keys()].sort()
    return isos[0] ?? null
  }, [allDays])

  const seed = initialMonth ?? firstMarked ?? new Date().toISOString().slice(0, 10)
  const [view, setView] = useState(() => {
    const d = new Date(`${seed}T00:00:00Z`)
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
  })

  const locale = i18n.language === 'es' ? 'es-ES' : 'de-DE'
  const monthLabel = new Date(Date.UTC(view.year, view.month, 1)).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const weeks = useMemo<DayMarks[][]>(() => {
    const firstOfMonth = new Date(Date.UTC(view.year, view.month, 1))
    // Monday-first grid (Germany). JS getUTCDay: 0=Sun..6=Sat → shift to Mon=0.
    const startOffset = (firstOfMonth.getUTCDay() + 6) % 7
    const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate()

    const cells: DayMarks[] = []
    // Leading days from previous month (greyed)
    for (let i = 0; i < startOffset; i++) {
      cells.push({ iso: `pad-start-${i}`, day: 0, inMonth: false, milestones: [] })
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoOf(view.year, view.month, day)
      const set = allDays.get(iso)
      cells.push({
        iso,
        day,
        inMonth: true,
        milestones: set ? CYCLE_MILESTONE_ORDER.filter((m) => set.has(m)) : [],
      })
    }
    while (cells.length % 7 !== 0) {
      cells.push({ iso: `pad-end-${cells.length}`, day: 0, inMonth: false, milestones: [] })
    }

    const rows: DayMarks[][] = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [view, allDays])

  const weekdayLabels = [
    t('cycle.weekday.mon'),
    t('cycle.weekday.tue'),
    t('cycle.weekday.wed'),
    t('cycle.weekday.thu'),
    t('cycle.weekday.fri'),
    t('cycle.weekday.sat'),
    t('cycle.weekday.sun'),
  ]

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(Date.UTC(v.year, v.month + delta, 1))
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
    })
  }

  return (
    <div className="rounded-l border border-line bg-bg-1 p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="btn btn-g btn-sm"
          aria-label={t('cycle.calendar.prevMonth')}
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <span className="text-sm font-medium capitalize text-fg-1">{monthLabel}</span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="btn btn-g btn-sm"
          aria-label={t('cycle.calendar.nextMonth')}
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekdayLabels.map((label) => (
          <div key={label} className="nx-label py-1 text-center">
            {label}
          </div>
        ))}
        {weeks.flat().map((cell) => (
          <div
            key={cell.iso}
            className={`flex min-h-14 flex-col rounded-s border p-1 ${
              cell.inMonth ? 'border-line bg-bg-0' : 'border-transparent bg-transparent'
            }`}
          >
            {cell.inMonth && (
              <>
                <span className="text-xs text-fg-3">{cell.day}</span>
                <div className="mt-auto flex flex-wrap gap-1">
                  {cell.milestones.map((m) => (
                    <span
                      key={m}
                      title={t(CYCLE_MILESTONES[m].labelKey)}
                      className={`inline-block h-2 w-2 rounded-s ${CYCLE_MILESTONES[m].bgClass}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
