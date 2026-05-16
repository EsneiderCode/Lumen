import { useLocation, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

// Map of path segment → breadcrumb label (NEXUS.OS convention: uppercase mono)
const SEGMENT_LABEL_KEYS: Record<string, string> = {
  admin: 'breadcrumb.admin',
  tech: 'breadcrumb.tech',
  contractor: 'breadcrumb.contractor',
  orders: 'breadcrumb.orders',
  new: 'breadcrumb.new',
  edit: 'breadcrumb.edit',
  assign: 'breadcrumb.assign',
  certification: 'breadcrumb.certification',
  'service-items': 'breadcrumb.service-items',
  personnel: 'breadcrumb.personnel',
  materials: 'breadcrumb.materials',
  settings: 'breadcrumb.settings',
  rueckmeldung: 'breadcrumb.rueckmeldung',
  schedule: 'breadcrumb.schedule',
  documents: 'breadcrumb.documents',
  certifications: 'breadcrumb.certifications',
}

// Root label per user area. Admin lands on Overview when no sub-path.
const AREA_ROOT_LABEL_KEYS: Record<string, string> = {
  admin: 'breadcrumb.overview',
  tech: 'breadcrumb.dashboard',
  contractor: 'breadcrumb.dashboard',
}

/**
 * Derives the breadcrumb trail from the current pathname. Uses the NEXUS.OS
 * pattern "HMR Nexus / Area / Current" with the last crumb highlighted.
 * IDs and UUID-like segments are omitted so the trail stays readable.
 */
export function Breadcrumb() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const params = useParams()
  const idValues = new Set(Object.values(params).filter(Boolean) as string[])

  const segments = pathname.split('/').filter(Boolean)
  const crumbs: string[] = []

  // Area root (admin/tech/contractor) gives us the first crumb
  const area = segments[0]
  if (area && area in AREA_ROOT_LABEL_KEYS) {
    crumbs.push(t(SEGMENT_LABEL_KEYS[area] ?? area))
    if (segments.length === 1) {
      crumbs.push(t(AREA_ROOT_LABEL_KEYS[area]))
    }
  }

  for (const seg of segments.slice(1)) {
    if (idValues.has(seg)) continue
    crumbs.push(SEGMENT_LABEL_KEYS[seg] ? t(SEGMENT_LABEL_KEYS[seg]) : seg)
  }

  if (crumbs.length === 0) return null

  return (
    <nav className="nx-breadcrumb" aria-label="Breadcrumb">
      <span>HMR Nexus</span>
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <span key={`${c}-${i}`}>
            <span className="sep">/</span>
            <span className={last ? 'cur' : ''}>{c}</span>
          </span>
        )
      })}
    </nav>
  )
}
