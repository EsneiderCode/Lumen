import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthUser } from './authTypes'
import { authService } from '@/services/authService'
import { supabase } from '@/lib/supabase'

export type { AuthUser, AuthContextType } from './authTypes'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        setUser(null)
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
            if (mounted) setUser(profile)
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
    if (result.user) setUser(result.user)
    return { user: result.user, error: result.error }
  }, [])

  const getTeamByPin = useCallback(async (pin: string) => {
    return authService.getTeamByPin(pin)
  }, [])

  const signInWithTeamPin = useCallback(async (pin: string, profileId: string) => {
    const result = await authService.signInWithTeamPin(pin, profileId)
    if (result.user) setUser(result.user)
    return { user: result.user, error: result.error }
  }, [])

  const signOut = useCallback(async () => {
    await authService.signOut()
    setUser(null)
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    return authService.resetPassword(email)
  }, [])

  const updatePin = useCallback(async (currentPin: string, newPin: string) => {
    return authService.updatePin(currentPin, newPin)
  }, [])

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isLoading,
      signInWithEmail,
      getTeamByPin,
      signInWithTeamPin,
      signOut,
      resetPassword,
      updatePin,
    }),
    [user, isLoading, signInWithEmail, getTeamByPin, signInWithTeamPin, signOut, resetPassword, updatePin],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
