import { describe, expect, it } from 'vitest'
import {
  ALL_PERMISSION_KEYS,
  MODULE_REGISTRY,
  ROUTE_PERMISSIONS,
  fallbackPermissionsForRole,
  getLandingRoute,
  hasAdminPanelAccess,
  registryToSyncPayload,
} from '@/config/permissions'
import { ROUTES } from '@/config/routes'

describe('permission registry integrity', () => {
  it('has no duplicate modules or permission keys', () => {
    const modules = MODULE_REGISTRY.map((entry) => entry.module)
    expect(new Set(modules).size).toBe(modules.length)
    expect(new Set(ALL_PERMISSION_KEYS).size).toBe(ALL_PERMISSION_KEYS.length)
  })

  it('maps every admin route to a permission that exists in the registry', () => {
    const keys = new Set<string>(ALL_PERMISSION_KEYS)
    for (const route of Object.values(ROUTES.ADMIN)) {
      expect(ROUTE_PERMISSIONS[route], `route ${route} has no permission mapping`).toBeDefined()
      expect(keys.has(ROUTE_PERMISSIONS[route])).toBe(true)
    }
  })

  it('exports one sync payload entry per permission key', () => {
    const payload = registryToSyncPayload()
    expect(payload).toHaveLength(ALL_PERMISSION_KEYS.length)
    expect(payload.map((entry) => `${entry.module}.${entry.action}`).sort()).toEqual(
      [...ALL_PERMISSION_KEYS].sort(),
    )
  })

  it('declares the four portal-access permissions', () => {
    for (const key of [
      'portal.admin.access',
      'portal.tech.access',
      'portal.contractor.access',
      'portal.scheduler.access',
    ]) {
      expect(ALL_PERMISSION_KEYS).toContain(key)
    }
  })
})

describe('getLandingRoute', () => {
  it('lands admins on the dashboard', () => {
    expect(getLandingRoute(new Set(ALL_PERMISSION_KEYS))).toBe(ROUTES.ADMIN.DASHBOARD)
  })

  it('lands a restricted admin-portal role on its first permitted page', () => {
    const perms = new Set(['portal.admin.access', 'work_orders.view'])
    expect(getLandingRoute(perms)).toBe(ROUTES.ADMIN.ORDERS)
  })

  it('falls through portals by priority', () => {
    expect(getLandingRoute(new Set(['portal.tech.access']))).toBe(ROUTES.TECHNICIAN.DASHBOARD)
    expect(getLandingRoute(new Set(['portal.contractor.access']))).toBe(ROUTES.CONTRACTOR.DASHBOARD)
    expect(getLandingRoute(new Set(['portal.scheduler.access']))).toBe(ROUTES.SCHEDULER.APPOINTMENTS)
  })

  it('lands users with admin-page permissions in the admin panel without portal.admin.access', () => {
    expect(getLandingRoute(new Set(['work_orders.view']))).toBe(ROUTES.ADMIN.ORDERS)
    expect(getLandingRoute(new Set(['portal.scheduler.access', 'certification.view']))).toBe(
      ROUTES.ADMIN.CERTIFICATION,
    )
  })

  it('sends users without any portal access back to login', () => {
    expect(getLandingRoute(new Set())).toBe(ROUTES.LOGIN)
  })
})

describe('hasAdminPanelAccess', () => {
  it('grants access via portal.admin.access or any admin-page permission', () => {
    expect(hasAdminPanelAccess(new Set(['portal.admin.access']))).toBe(true)
    expect(hasAdminPanelAccess(new Set(['work_orders.view']))).toBe(true)
    expect(hasAdminPanelAccess(new Set(['roles.view']))).toBe(true)
  })

  it('denies access for permissions that unlock no admin page', () => {
    expect(hasAdminPanelAccess(new Set())).toBe(false)
    expect(hasAdminPanelAccess(new Set(['portal.scheduler.access']))).toBe(false)
    expect(hasAdminPanelAccess(new Set(['appointments.view']))).toBe(false)
  })
})

describe('fallbackPermissionsForRole', () => {
  it('mirrors the migration 034 system-role seed', () => {
    expect(fallbackPermissionsForRole('admin')).toEqual(new Set(ALL_PERMISSION_KEYS))
    expect(fallbackPermissionsForRole('technician')).toEqual(new Set(['portal.tech.access']))
    expect(fallbackPermissionsForRole('contractor')).toEqual(new Set(['portal.contractor.access']))
    expect(fallbackPermissionsForRole('scheduler')).toEqual(new Set(['portal.scheduler.access']))
    expect(fallbackPermissionsForRole(null)).toEqual(new Set())
  })
})
