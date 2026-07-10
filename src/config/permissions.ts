import { ROUTES } from '@/config/routes'
import type { UserRole } from '@/types/enums'

// ─────────────────────────────────────────────────────────────────────────────
// Central permission registry — single source of truth in the frontend.
//
// Adding a new module (or a new action to an existing one) here is ALL that is
// needed for it to show up in the roles admin UI: opening /admin/roles calls
// sync_permissions() with this registry, the missing keys are created in the
// `permissions` table and auto-granted to roles flagged `auto_grant_new`.
//
// Must stay in sync with the seed in supabase/migrations/034_rbac_core.sql.
// ─────────────────────────────────────────────────────────────────────────────

export const MODULE_REGISTRY = [
  {
    module: 'work_orders',
    actions: [
      'view', 'create', 'edit', 'delete', 'assign', 'transition_status', 'bulk_action',
      'manage_photos', 'manage_documents', 'view_billing', 'edit_billing', 'export',
    ],
  },
  {
    module: 'certification',
    actions: ['view', 'certify_internal', 'accept_client', 'invoice', 'export_excel', 'export_datev', 'generate_pdf'],
  },
  { module: 'service_catalog', actions: ['view', 'create', 'edit', 'delete', 'toggle_active'] },
  { module: 'projects', actions: ['view', 'create', 'edit', 'deactivate'] },
  { module: 'users', actions: ['view', 'create', 'edit', 'delete'] },
  { module: 'roles', actions: ['view', 'create', 'edit', 'delete', 'assign'] },
  {
    module: 'employees',
    actions: ['view', 'create', 'edit', 'deactivate', 'manage_vacations', 'generate_payroll'],
  },
  { module: 'onboarding', actions: ['view', 'edit', 'generate_pdf', 'review_documents'] },
  {
    module: 'materials',
    actions: ['view', 'create', 'edit', 'deactivate', 'import', 'register_consumption'],
  },
  { module: 'cycles', actions: ['view', 'create', 'edit', 'delete', 'publish'] },
  { module: 'settings', actions: ['view', 'manage_telegram', 'manage_team_pins'] },
  { module: 'dashboard', actions: ['view'] },
  { module: 'appointments', actions: ['view', 'create', 'edit', 'confirm', 'complete', 'cancel'] },
  { module: 'portal', actions: ['admin.access', 'tech.access', 'contractor.access', 'scheduler.access'] },
] as const

type RegistryEntry = (typeof MODULE_REGISTRY)[number]

export type ModuleName = RegistryEntry['module']

export type PermissionKey = RegistryEntry extends infer E
  ? E extends { module: infer M extends string; actions: readonly (infer A extends string)[] }
    ? `${M}.${A}`
    : never
  : never

export const ALL_PERMISSION_KEYS: PermissionKey[] = MODULE_REGISTRY.flatMap((entry) =>
  entry.actions.map((action) => `${entry.module}.${action}` as PermissionKey),
)

/** Payload for the sync_permissions() RPC. */
export function registryToSyncPayload(): { module: string; action: string }[] {
  return MODULE_REGISTRY.flatMap((entry) =>
    entry.actions.map((action) => ({ module: entry.module, action })),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Route → required permission. Consumed by App.tsx (RequirePermission) and the
// admin Sidebar so both always agree.
// ─────────────────────────────────────────────────────────────────────────────

export const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  [ROUTES.ADMIN.DASHBOARD]: 'dashboard.view',
  [ROUTES.ADMIN.ORDERS]: 'work_orders.view',
  [ROUTES.ADMIN.ORDERS_NEW]: 'work_orders.create',
  [ROUTES.ADMIN.ORDERS_EDIT]: 'work_orders.edit',
  [ROUTES.ADMIN.ORDERS_ASSIGN]: 'work_orders.assign',
  [ROUTES.ADMIN.ORDERS_DETAIL]: 'work_orders.view',
  [ROUTES.ADMIN.CERTIFICATION]: 'certification.view',
  [ROUTES.ADMIN.SERVICE_ITEMS]: 'service_catalog.view',
  [ROUTES.ADMIN.PROJECTS]: 'projects.view',
  [ROUTES.ADMIN.PROJECTS_DETAIL]: 'projects.view',
  [ROUTES.ADMIN.PERSONNEL]: 'users.view',
  [ROUTES.ADMIN.EMPLOYEES]: 'employees.view',
  [ROUTES.ADMIN.ONBOARDING]: 'onboarding.view',
  [ROUTES.ADMIN.MATERIALS]: 'materials.view',
  [ROUTES.ADMIN.CYCLES]: 'cycles.view',
  [ROUTES.ADMIN.SETTINGS]: 'settings.view',
  [ROUTES.ADMIN.ROLES]: 'roles.view',
  [ROUTES.ADMIN.ROLES_DETAIL]: 'roles.view',
}

// Landing candidates inside the admin portal, in sidebar order: after login (or
// when a page is denied) the user is sent to the first one they may view.
const ADMIN_LANDING_CANDIDATES: string[] = [
  ROUTES.ADMIN.DASHBOARD,
  ROUTES.ADMIN.ORDERS,
  ROUTES.ADMIN.CERTIFICATION,
  ROUTES.ADMIN.SERVICE_ITEMS,
  ROUTES.ADMIN.PROJECTS,
  ROUTES.ADMIN.PERSONNEL,
  ROUTES.ADMIN.ROLES,
  ROUTES.ADMIN.EMPLOYEES,
  ROUTES.ADMIN.MATERIALS,
  ROUTES.ADMIN.CYCLES,
  ROUTES.ADMIN.SETTINGS,
]

/** First route the user is allowed to land on, by portal priority. */
export function getLandingRoute(permissions: ReadonlySet<string>): string {
  if (permissions.has('portal.admin.access')) {
    const candidate = ADMIN_LANDING_CANDIDATES.find((route) =>
      permissions.has(ROUTE_PERMISSIONS[route]),
    )
    if (candidate) return candidate
  }
  if (permissions.has('portal.tech.access')) return ROUTES.TECHNICIAN.DASHBOARD
  if (permissions.has('portal.contractor.access')) return ROUTES.CONTRACTOR.DASHBOARD
  if (permissions.has('portal.scheduler.access')) return ROUTES.SCHEDULER.APPOINTMENTS
  return ROUTES.LOGIN
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline / pre-migration fallback: mirrors the system-role seed of migration
// 034 so the app stays usable when get_my_permissions() is unreachable (PIN
// offline login, network errors) — derived from the base persona.
// ─────────────────────────────────────────────────────────────────────────────

export function fallbackPermissionsForRole(role: UserRole | null): Set<string> {
  switch (role) {
    case 'admin':
      return new Set<string>(ALL_PERMISSION_KEYS)
    case 'technician':
      return new Set(['portal.tech.access'])
    case 'contractor':
      return new Set(['portal.contractor.access'])
    case 'scheduler':
      return new Set(['portal.scheduler.access'])
    default:
      return new Set()
  }
}
