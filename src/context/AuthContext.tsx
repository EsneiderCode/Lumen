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

    async function initAuth() {
      try {
        const profile = await authService.getCurrentUser()
        if (mounted) setUser(profile)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        setUser(null)
        return
      }

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        const profile = await authService.getCurrentUser()
        if (mounted && profile) setUser(profile)
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

  const signInWithPin = useCallback(async (team: import('@/types/enums').TeamColor, pin: string) => {
    const result = await authService.signInWithPin(team, pin)
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

  const updatePin = useCallback(async (newPin: string) => {
    return authService.updatePin(newPin)
  }, [])

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isLoading,
      signInWithEmail,
      signInWithPin,
      signOut,
      resetPassword,
      updatePin,
    }),
    [user, isLoading, signInWithEmail, signInWithPin, signOut, resetPassword, updatePin],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
