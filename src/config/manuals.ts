import type { UserRole } from '@/types/enums'

/**
 * Returns the public path to the onboarding manual PDF for the given role and language.
 * - admin      → always Spanish (only one variant)
 * - technician → always Spanish (only one variant)
 * - contractor → German ('de') or Spanish (all other locales)
 */
export function manualHrefForRole(role: UserRole, lang: string): string {
  switch (role) {
    case 'admin':
      return '/manuals/manual-administrador-es.pdf'
    case 'technician':
      return '/manuals/manual-interno-es.pdf'
    case 'contractor':
      return lang.startsWith('de')
        ? '/manuals/handbuch-extern-de.pdf'
        : '/manuals/manual-externo-es.pdf'
  }
}
