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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setIsLoading(false)
        return
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Pass session.user.id when available to avoid calling getSession() inside the callback,
        // which would race with the lock already held by onAuthStateChange.
        const profile = await authService.getCurrentUser(session?.user?.id)
        if (mounted) {
          setUser(profile)
          setIsLoading(false)
        }
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
