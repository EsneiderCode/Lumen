import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { CycleCalendar } from '@/components/cycle/CycleCalendar'
import { CycleLegend } from '@/components/cycle/CycleLegend'
import {
  listPublishedCyclesForContractor,
  type CollaboratorCycle,
} from '@/services/collaboratorCyclesService'

export function ContractorCalendarPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [cycles, setCycles] = useState<CollaboratorCycle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const { data, error: err } = await listPublishedCyclesForContractor(userId)
      if (cancelled) return
      setCycles(data)
      setError(err)
      setIsLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (!user) return null

  return (
    <div className="space-y-5">
      <div className="nx-page-header">
        <h2 className="nx-page-title">{t('cycle.view.contractorTitle')}</h2>
        <p className="nx-label mt-2">{t('cycle.view.contractorSubtitle')}</p>
      </div>

      <CycleLegend />

      {error && (
        <div className="rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-fg-3">[LOADING]</p>
      ) : cycles.length === 0 ? (
        <p className="text-sm text-fg-3">{t('cycle.view.emptyContractor')}</p>
      ) : (
        <CycleCalendar cycles={cycles} />
      )}
    </div>
  )
}
