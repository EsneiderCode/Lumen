import { useTranslation } from 'react-i18next'
import { ContractorDocumentsPanel } from '@/components/contractor/ContractorDocumentsPanel'
import { useAuth } from '@/hooks/useAuth'
import { ManualCard } from '@/components/profile/ManualCard'

export function ContractorDocumentsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="space-y-5">
      <div className="nx-page-header">
        <div>
          <h2 className="nx-page-title">{t('contractorDocs.pageTitle')}</h2>
          <p className="nx-label mt-2">{t('contractorDocs.pageSubtitle')}</p>
        </div>
      </div>

      <ManualCard />

      <ContractorDocumentsPanel contractorId={user.id} />
    </div>
  )
}
