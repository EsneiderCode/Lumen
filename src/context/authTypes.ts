import { createContext } from 'react'
import type { UserRole } from '@/types/enums'

export interface AuthUser {
  id: string
  email: string | null
  fullName: string
  role: UserRole
  team: string | null
}

export interface TeamMember {
  id: string
  fullName: string
  role: 'technician' | 'contractor'
}

export interface AuthContextType {
  user: AuthUser | null
  role: UserRole | null
  isLoading: boolean
  signInWithEmail: (email: string, password: string) => Promise<{ user: AuthUser | null; error: string | null }>
  getTeamByPin: (pin: string) => Promise<{ team: string | null; members: TeamMember[]; error: string | null }>
  signInWithTeamPin: (pin: string, profileId: string) => Promise<{ user: AuthUser | null; error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePin: (currentPin: string, newPin: string) => Promise<{ error: string | null }>
}

export const AuthContext = createContext<AuthContextType | null>(null)
