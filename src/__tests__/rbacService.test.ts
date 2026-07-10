import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registryToSyncPayload } from '@/config/permissions'

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}))

import {
  deleteRole,
  fetchMyPermissions,
  fetchRoles,
  setRolePermissions,
  syncPermissions,
} from '@/services/rbacService'

interface ChainCall {
  method: string
  args: unknown[]
}

// Minimal chainable PostgREST builder: records calls, resolves `result`.
function chain(result: unknown) {
  const calls: ChainCall[] = []
  const builder: Record<string, unknown> = { calls }
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'single']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return builder as Record<string, unknown> & { calls: ChainCall[] }
}

beforeEach(() => {
  mockFrom.mockReset()
  mockRpc.mockReset()
})

describe('fetchMyPermissions / syncPermissions', () => {
  it('returns the permission keys from the RPC', async () => {
    mockRpc.mockResolvedValue({ data: ['work_orders.view', 'portal.admin.access'], error: null })
    const { data, error } = await fetchMyPermissions()
    expect(mockRpc).toHaveBeenCalledWith('get_my_permissions')
    expect(error).toBeNull()
    expect(data).toEqual(['work_orders.view', 'portal.admin.access'])
  })

  it('sends the full MODULE_REGISTRY to sync_permissions and returns created keys', async () => {
    mockRpc.mockResolvedValue({ data: { created: ['reports.view'] }, error: null })
    const { data, error } = await syncPermissions()
    expect(mockRpc).toHaveBeenCalledWith('sync_permissions', { perms: registryToSyncPayload() })
    expect(error).toBeNull()
    expect(data).toEqual(['reports.view'])
  })
})

describe('setRolePermissions', () => {
  it('inserts only missing grants and deletes only removed ones', async () => {
    const selectChain = chain({
      data: [{ permission_id: 'a' }, { permission_id: 'b' }],
      error: null,
    })
    const insertChain = chain({ data: null, error: null })
    const deleteChain = chain({ data: null, error: null })
    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(deleteChain)

    const { error } = await setRolePermissions('role-1', ['b', 'c'])
    expect(error).toBeNull()

    const insertCall = insertChain.calls.find((call) => call.method === 'insert')
    expect(insertCall?.args[0]).toEqual([{ role_id: 'role-1', permission_id: 'c' }])

    const inCall = deleteChain.calls.find((call) => call.method === 'in')
    expect(inCall?.args).toEqual(['permission_id', ['a']])
  })

  it('makes no writes when the target set matches the current one', async () => {
    mockFrom.mockReturnValueOnce(
      chain({ data: [{ permission_id: 'a' }], error: null }),
    )
    const { error } = await setRolePermissions('role-1', ['a'])
    expect(error).toBeNull()
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })
})

describe('deleteRole', () => {
  it('refuses to delete system roles', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { is_system: true }, error: null }))
    const { error } = await deleteRole('role-admin')
    expect(error).toBe('SYSTEM_ROLE')
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('deletes custom roles', async () => {
    const deleteChain = chain({ data: null, error: null })
    mockFrom
      .mockReturnValueOnce(chain({ data: { is_system: false }, error: null }))
      .mockReturnValueOnce(deleteChain)
    const { error } = await deleteRole('role-custom')
    expect(error).toBeNull()
    expect(deleteChain.calls.some((call) => call.method === 'delete')).toBe(true)
  })
})

describe('fetchRoles', () => {
  it('merges permission and user counts per role', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'roles') {
        return chain({
          data: [
            { id: 'r1', name: 'admin', is_system: true },
            { id: 'r2', name: 'Supervisor', is_system: false },
          ],
          error: null,
        })
      }
      if (table === 'role_permissions') {
        return chain({ data: [{ role_id: 'r1' }, { role_id: 'r1' }, { role_id: 'r2' }], error: null })
      }
      return chain({ data: [{ role_id: 'r1' }], error: null })
    })

    const { data, error } = await fetchRoles()
    expect(error).toBeNull()
    expect(data).toEqual([
      expect.objectContaining({ id: 'r1', permissionCount: 2, userCount: 1 }),
      expect.objectContaining({ id: 'r2', permissionCount: 1, userCount: 0 }),
    ])
  })
})
