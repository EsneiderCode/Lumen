import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthUser } from './authTypes'
import { authService } from '@/services/authService'
import { fetchMyPermissions } from '@/services/rbacService'
import { fallbackPermissionsForRole, getLandingRoute, type PermissionKey } from '@/config/permissions'
import { supabase } from '@/lib/supabase'

export type { AuthUser, AuthContextType } from './authTypes'

const PERMS_CACHE_PREFIX = 'lumen-perms-'

// Effective permissions come from get_my_permissions(). When it is unreachable
// (offline PIN login, network errors) fall back to the last cached set, and as
// a last resort to the base-persona defaults mirroring the migration 034 seed.
async function resolvePermissions(profile: AuthUser): Promise<Set<string>> {
  const { data, error } = await fetchMyPermissions()
  if (!error && data) {
    try {
      localStorage.setItem(PERMS_CACHE_PREFIX + profile.id, JSON.stringify(data))
    } catch {
      // storage full/unavailable — cache is best-effort
    }
    return new Set(data)
  }
  try {
    const cached = localStorage.getItem(PERMS_CACHE_PREFIX + profile.id)
    if (cached) return new Set(JSON.parse(cached) as string[])
  } catch {
    // corrupt cache — ignore
  }
  return fallbackPermissionsForRole(profile.role)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<ReadonlySet<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setPermissions(new Set())
        setIsLoading(false)
        return
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // IMPORTANT: this callback runs while auth-js holds its internal lock. Any awaited
        // Supabase call here (getCurrentUser → supabase.from(...) → getSession()) re-enters
        // that lock and deadlocks — on reload it leaves isLoading stuck true forever.
        // Defer the profile fetch to a fresh task so the callback returns and releases the
        // lock first. (setTimeout, not queueMicrotask — the microtask still runs under the lock.)
        const userId = session?.user?.id
        setTimeout(async () => {
          if (!mounted) return
          try {
            const profile = await authService.getCurrentUser(userId)
            if (mounted && profile) {
              const perms = await resolvePermissions(profile)
              if (mounted) {
                setPermissions(perms)
                setUser(profile)
              }
            } else if (mounted) {
              setPermissions(new Set())
              setUser(null)
            }
          } catch {
            // Network error during token refresh — keep current user state
          } finally {
            if (mounted) setIsLoading(false)
          }
        }, 0)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const result = await authService.signInWithEmail(email, password)
    if (!result.user) return { user: null, landingRoute: null, error: result.error }
    const perms = await resolvePermissions(result.user)
    setPermissions(perms)
    setUser(result.user)
    return { user: result.user, landingRoute: getLandingRoute(perms), error: result.error }
  }, [])

  const getTeamByPin = useCallback(async (pin: string) => {
    return authService.getTeamByPin(pin)
  }, [])

  const signInWithTeamPin = useCallback(async (pin: string, profileId: string) => {
    const result = await authService.signInWithTeamPin(pin, profileId)
    if (!result.user) return { user: null, landingRoute: null, error: result.error }
    const perms = await resolvePermissions(result.user)
    setPermissions(perms)
    setUser(result.user)
    return { user: result.user, landingRoute: getLandingRoute(perms), error: result.error }
  }, [])

  const signOut = useCallback(async () => {
    await authService.signOut()
    setUser(null)
    setPermissions(new Set())
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    return authService.resetPassword(email)
  }, [])

  const updatePin = useCallback(async (currentPin: string, newPin: string) => {
    return authService.updatePin(currentPin, newPin)
  }, [])

  const can = useCallback(
    (permission: PermissionKey) => permissions.has(permission),
    [permissions],
  )

  const refreshPermissions = useCallback(async () => {
    if (!user) return
    setPermissions(await resolvePermissions(user))
  }, [user])

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      permissions,
      can,
      refreshPermissions,
      isLoading,
      signInWithEmail,
      getTeamByPin,
      signInWithTeamPin,
      signOut,
      resetPassword,
      updatePin,
    }),
    [user, permissions, can, refreshPermissions, isLoading, signInWithEmail, getTeamByPin, signInWithTeamPin, signOut, resetPassword, updatePin],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
