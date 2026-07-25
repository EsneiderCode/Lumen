import { describe, it, expect, beforeEach } from 'vitest'
import { getPinAccessToken, getPinSessionStatus } from '@/services/pinSession'

const KEY = 'lumen-pin-session-v1'

function seed(expiresAtSeconds: number) {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      accessToken: 'pin-token',
      expiresAt: expiresAtSeconds,
      user: { id: 'tech-1', email: null, fullName: 'Tech', role: 'technician', team: 'rot' },
      deviceId: 'device-1',
      localPinHash: 'pbkdf2$1$a$b',
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
})

// An expired PIN session used to be indistinguishable from "no PIN session":
// both returned null, so requests silently fell back to the anon key and RLS
// answered with an empty read or a cryptic 42501 on writes.
describe('getPinSessionStatus', () => {
  it('reports none when nothing is stored', () => {
    expect(getPinSessionStatus()).toEqual({ status: 'none' })
  })

  it('reports active with the token while valid', () => {
    seed(Math.floor(Date.now() / 1000) + 3600)
    expect(getPinSessionStatus()).toEqual({ status: 'active', accessToken: 'pin-token' })
  })

  it('reports expired instead of none once the token times out', () => {
    seed(Math.floor(Date.now() / 1000) - 1)
    expect(getPinSessionStatus()).toEqual({ status: 'expired' })
    expect(getPinAccessToken()).toBeNull()
  })
})
