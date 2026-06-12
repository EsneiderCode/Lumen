import { describe, expect, it } from 'vitest'
import { deriveOrderDefaultsFromProject } from '@/lib/orderFormDefaults'

describe('deriveOrderDefaultsFromProject', () => {
  it('returns an empty object without a project', () => {
    expect(deriveOrderDefaultsFromProject(undefined)).toEqual({})
  })

  it('returns all derivable values when the project has all defaults', () => {
    expect(
      deriveOrderDefaultsFromProject({
        id: 'project-1',
        client_id: 'client-1',
        default_operator_id: 'operator-1',
        default_line: 'NE4',
      }),
    ).toEqual({
      client_id: 'client-1',
      operator_id: 'operator-1',
      line: 'NE4',
    })
  })

  it('returns only client_id when that is the only project default', () => {
    expect(
      deriveOrderDefaultsFromProject({
        id: 'project-1',
        client_id: 'client-1',
        default_operator_id: null,
        default_line: null,
      }),
    ).toEqual({ client_id: 'client-1' })
  })

  it('omits default_line when it is null', () => {
    expect(
      deriveOrderDefaultsFromProject({
        id: 'project-1',
        client_id: null,
        default_operator_id: 'operator-1',
        default_line: null,
      }),
    ).toEqual({ operator_id: 'operator-1' })
  })
})
