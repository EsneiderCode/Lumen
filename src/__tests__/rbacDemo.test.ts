import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoSupabaseClient } from '@/lib/demo/supabase-mock'
import { resetStore } from '@/lib/demo/store'
import { DEMO_PASSWORD } from '@/lib/demo/fixtures'

const TECH_ID = '00000000-0000-0000-0000-000000000002'
const ROLE_SUPERVISOR = '90000000-0000-0000-0000-000000000010'

beforeEach(() => {
  resetStore()
})

async function signIn(client: ReturnType<typeof createDemoSupabaseClient>, email: string) {
  const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD })
  expect(error).toBeNull()
}

describe('demo RBAC: effective permissions per user', () => {
  it('gives the admin every permission including roles management', async () => {
    const client = createDemoSupabaseClient()
    await signIn(client, 'admin@demo.lumen')
    const { data, error } = await client.rpc('get_my_permissions')
    expect(error).toBeNull()
    const keys = data as string[]
    expect(keys).toContain('portal.admin.access')
    expect(keys).toContain('roles.edit')
    expect(keys).toContain('work_orders.delete')
  })

  it('gives field personas only their portal access', async () => {
    const client = createDemoSupabaseClient()
    await signIn(client, 'tech@demo.lumen')
    const { data } = await client.rpc('get_my_permissions')
    expect(data).toEqual(['portal.tech.access'])
  })

  it('grants permissions through a custom role assignment', async () => {
    const client = createDemoSupabaseClient()
    await signIn(client, 'admin@demo.lumen')
    await client.from('user_roles').insert({ user_id: TECH_ID, role_id: ROLE_SUPERVISOR })

    const { data: allowed } = await client.rpc('user_has_permission', {
      uid: TECH_ID,
      perm: 'work_orders.view',
    })
    expect(allowed).toBe(true)

    await signIn(client, 'tech@demo.lumen')
    const { data } = await client.rpc('get_my_permissions')
    const keys = data as string[]
    expect(keys).toContain('portal.tech.access')
    expect(keys).toContain('portal.admin.access')
    expect(keys).toContain('work_orders.view')
    expect(keys).not.toContain('work_orders.delete')
  })

  it('grants direct user permissions additively', async () => {
    const client = createDemoSupabaseClient()
    await signIn(client, 'admin@demo.lumen')
    await client
      .from('user_permissions')
      .insert({ user_id: TECH_ID, permission_id: 'permission-work_orders.export' })

    const { data: allowed } = await client.rpc('user_has_permission', {
      uid: TECH_ID,
      perm: 'work_orders.export',
    })
    expect(allowed).toBe(true)
  })
})

describe('demo RBAC: sync_permissions', () => {
  it('registers new permissions and auto-grants them to auto_grant_new roles', async () => {
    const client = createDemoSupabaseClient()
    await signIn(client, 'admin@demo.lumen')

    const { data, error } = await client.rpc('sync_permissions', {
      perms: [{ module: 'reports', action: 'view' }],
    })
    expect(error).toBeNull()
    expect((data as { created: string[] }).created).toEqual(['reports.view'])

    // admin role has auto_grant_new → the new key shows up immediately
    const { data: mine } = await client.rpc('get_my_permissions')
    expect(mine as string[]).toContain('reports.view')

    // idempotent: second sync creates nothing
    const { data: again } = await client.rpc('sync_permissions', {
      perms: [{ module: 'reports', action: 'view' }],
    })
    expect((again as { created: string[] }).created).toEqual([])
  })

  it('rejects sync from users without roles.edit', async () => {
    const client = createDemoSupabaseClient()
    await signIn(client, 'tech@demo.lumen')
    const { error } = await client.rpc('sync_permissions', {
      perms: [{ module: 'reports', action: 'view' }],
    })
    expect(error).not.toBeNull()
  })
})
