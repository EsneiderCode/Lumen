import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ComplianceEntityPanel } from '@/components/compliance/ComplianceEntityPanel'
import { fetchEntityByProfileId } from '@/services/complianceService'
import type { ComplianceEntityRecord } from '@/services/complianceService'
import { useAuth } from '@/hooks/useAuth'
import { ManualCard } from '@/components/profile/ManualCard'

export function ContractorDocumentsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [entity, setEntity] = useState<ComplianceEntityRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      const { data, error: loadError } = await fetchEntityByProfileId(user!.id)
      if (cancelled) return
      setEntity(data)
      setError(loadError)
      setIsLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  if (!user) return null

  return (
    <div className="space-y-5">
      <div className="nx-page-header">
        <div>
          <h2 className="nx-page-title">{t('compliance.portal.pageTitle')}</h2>
          <p className="nx-label mt-2">{t('compliance.portal.pageSubtitle')}</p>
        </div>
      </div>

      <ManualCard />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="nx-loader" />
        </div>
      ) : error ? (
        <div className="rounded-s border border-err/30 bg-err/10 px-3 py-2 text-sm text-err">{error}</div>
      ) : entity ? (
        <ComplianceEntityPanel entity={entity} />
      ) : (
        <div className="rounded-l border border-line bg-bg-1 p-6 text-center">
          <p className="text-sm text-fg-2">{t('compliance.portal.noEntity')}</p>
        </div>
      )}
    </div>
  )
}
