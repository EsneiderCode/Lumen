import { createContext } from 'react'
import type { UserRole } from '@/types/enums'

export interface AuthUser {
  id: string
  email: string | null
  fullName: string
  role: UserRole
  team: string | null
  loginCode?: string | null
  authMethod?: 'email' | 'pin' | 'offline-pin'
}

export interface AuthContextType {
  user: AuthUser | null
  role: UserRole | null
  isLoading: boolean
  signInWithEmail: (email: string, password: string) => Promise<{ user: AuthUser | null; error: string | null }>
  signInWithPin: (loginCode: string, pin: string) => Promise<{ user: AuthUser | null; error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
}

export const AuthContext = createContext<AuthContextType | null>(null)
