import { createContext } from 'react'
import type { UserRole } from '@/types/enums'
import type { PermissionKey } from '@/config/permissions'

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

export interface SignInResult {
  user: AuthUser | null
  /** First route the user may land on, derived from their effective permissions. */
  landingRoute: string | null
  error: string | null
}

export interface AuthContextType {
  user: AuthUser | null
  role: UserRole | null
  /** Effective permission keys (roles + direct grants) for the current user. */
  permissions: ReadonlySet<string>
  can: (permission: PermissionKey) => boolean
  refreshPermissions: () => Promise<void>
  isLoading: boolean
  signInWithEmail: (email: string, password: string) => Promise<SignInResult>
  getTeamByPin: (pin: string) => Promise<{ team: string | null; members: TeamMember[]; error: string | null }>
  signInWithTeamPin: (pin: string, profileId: string) => Promise<SignInResult>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePin: (currentPin: string, newPin: string) => Promise<{ error: string | null }>
}

export const AuthContext = createContext<AuthContextType | null>(null)
