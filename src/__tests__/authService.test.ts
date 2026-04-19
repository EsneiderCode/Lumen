import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted() runs before the vi.mock() factory, so variables are available
const { mockAuth, mockFrom } = vi.hoisted(() => {
  const mockAuth = {
    signInWithPassword: vi.fn(),
    getSession: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  }
  const mockFrom = vi.fn()
  return { mockAuth, mockFrom }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: mockAuth, from: mockFrom },
}))

import { authService } from '@/services/authService'

const fakeProfile = {
  id: 'user-123',
  email: 'admin@nexus.de',
  full_name: 'Admin User',
  role: 'admin' as const,
  team: null,
}

function mockProfileFetch(profile: typeof fakeProfile | null, error = null) {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: profile, error }),
      }),
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── signInWithEmail ─────────────────────────────────────────────────────────

describe('authService.signInWithEmail', () => {
  it('returns user on successful login', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    mockProfileFetch(fakeProfile)

    const result = await authService.signInWithEmail('admin@nexus.de', 'password')
    expect(result.error).toBeNull()
    expect(result.user?.id).toBe('user-123')
    expect(result.user?.role).toBe('admin')
  })

  it('returns error when Supabase auth fails', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })

    const result = await authService.signInWithEmail('bad@nexus.de', 'wrong')
    expect(result.user).toBeNull()
    expect(result.error).toBe('Invalid login credentials')
  })

  it('returns error when profile is not found after auth', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-no-profile' } },
      error: null,
    })
    mockProfileFetch(null)

    const result = await authService.signInWithEmail('ghost@nexus.de', 'password')
    expect(result.user).toBeNull()
    expect(result.error).toMatch(/Profil nicht gefunden/)
  })
})

// ── getCurrentUser ──────────────────────────────────────────────────────────

describe('authService.getCurrentUser', () => {
  it('returns null when there is no active session', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } })

    const user = await authService.getCurrentUser()
    expect(user).toBeNull()
  })

  it('returns user when a valid session exists', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
    })
    mockProfileFetch(fakeProfile)

    const user = await authService.getCurrentUser()
    expect(user?.id).toBe('user-123')
    expect(user?.fullName).toBe('Admin User')
  })
})

// ── signOut ─────────────────────────────────────────────────────────────────

describe('authService.signOut', () => {
  it('calls supabase signOut', async () => {
    mockAuth.signOut.mockResolvedValue({})
    await authService.signOut()
    expect(mockAuth.signOut).toHaveBeenCalledOnce()
  })
})

// ── resetPassword ───────────────────────────────────────────────────────────

describe('authService.resetPassword', () => {
  it('returns null error on success', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null })
    const result = await authService.resetPassword('admin@nexus.de')
    expect(result.error).toBeNull()
  })

  it('returns friendly message for SMTP errors', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({
      error: { message: 'Error sending email', status: 500 },
    })
    const result = await authService.resetPassword('admin@nexus.de')
    expect(result.error).toMatch(/E-Mail-Dienst/)
  })

  it('returns raw error for non-SMTP failures', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({
      error: { message: 'User not found', status: 404 },
    })
    const result = await authService.resetPassword('nobody@nexus.de')
    expect(result.error).toBe('User not found')
  })
})

// ── updatePassword ──────────────────────────────────────────────────────────

describe('authService.updatePassword', () => {
  it('returns null error on success', async () => {
    mockAuth.updateUser.mockResolvedValue({ error: null })
    const result = await authService.updatePassword('NewSecure123!')
    expect(result.error).toBeNull()
  })

  it('propagates error message on failure', async () => {
    mockAuth.updateUser.mockResolvedValue({ error: { message: 'Password too short' } })
    const result = await authService.updatePassword('abc')
    expect(result.error).toBe('Password too short')
  })
})
