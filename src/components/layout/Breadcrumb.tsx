import { useLocation, useParams } from 'react-router'

// Map of path segment → breadcrumb label (NEXUS.OS convention: uppercase mono)
const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Operations',
  tech: 'Field',
  contractor: 'Contractor',
  orders: 'Orders',
  new: 'New',
  edit: 'Edit',
  assign: 'Assign',
  certification: 'Certification',
  'service-items': 'Services',
  personnel: 'People',
  materials: 'Inventory',
  settings: 'Settings',
  rueckmeldung: 'Rückmeldung',
  schedule: 'Schedule',
  documents: 'Documents',
  certifications: 'Certifications',
}

// Root label per user area. Admin lands on Overview when no sub-path.
const AREA_ROOT_LABEL: Record<string, string> = {
  admin: 'Overview',
  tech: 'Dashboard',
  contractor: 'Dashboard',
}

/**
 * Derives the breadcrumb trail from the current pathname. Uses the NEXUS.OS
 * pattern "HMR Nexus / Area / Current" with the last crumb highlighted.
 * IDs and UUID-like segments are omitted so the trail stays readable.
 */
export function Breadcrumb() {
  const { pathname } = useLocation()
  const params = useParams()
  const idValues = new Set(Object.values(params).filter(Boolean) as string[])

  const segments = pathname.split('/').filter(Boolean)
  const crumbs: string[] = []

  // Area root (admin/tech/contractor) gives us the first crumb
  const area = segments[0]
  if (area && area in AREA_ROOT_LABEL) {
    crumbs.push(SEGMENT_LABELS[area] ?? area)
    if (segments.length === 1) {
      crumbs.push(AREA_ROOT_LABEL[area])
    }
  }

  for (const seg of segments.slice(1)) {
    if (idValues.has(seg)) continue
    crumbs.push(SEGMENT_LABELS[seg] ?? seg)
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
