import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PanelsTopLeft } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { getLandingRoute, hasAdminPanelAccess } from '@/config/permissions'

/**
 * Header link back to the admin panel, shown in the field/scheduler portals
 * only when the user's permissions grant admin panel access (derived — any
 * admin-page permission counts, see hasAdminPanelAccess).
 */
export function AdminPanelLink() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { permissions } = usePermissions()

  if (!hasAdminPanelAccess(permissions)) return null

  return (
    <button
      type="button"
      onClick={() => navigate(getLandingRoute(permissions))}
      className="btn btn-g btn-sm flex items-center gap-1.5"
    >
      <PanelsTopLeft size={14} strokeWidth={1.5} />
      {t('nav.adminPanel')}
    </button>
  )
}
