import { createContext } from 'react'
import type { UserRole, TeamColor } from '@/types/enums'

export interface AuthUser {
  id: string
  email: string | null
  fullName: string
  role: UserRole
  team: string | null
}

export interface AuthContextType {
  user: AuthUser | null
  role: UserRole | null
  isLoading: boolean
  signInWithEmail: (email: string, password: string) => Promise<{ user: AuthUser | null; error: string | null }>
  signInWithPin: (team: TeamColor, pin: string) => Promise<{ user: AuthUser | null; error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePin: (newPin: string) => Promise<{ error: string | null }>
}

export const AuthContext = createContext<AuthContextType | null>(null)
