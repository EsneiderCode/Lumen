/**
 * Who owns a company or freelancer — i.e. which login can manage its own
 * documents and workers from the portal.
 *
 * This is not decoration. `compliance_entities.profile_id` is what the RLS
 * policies of 042/057 check: an entity with no owner cannot add a worker, cannot
 * upload a document and cannot see itself in the portal. It is inert from the
 * moment it is created, and nothing in the UI used to say so — which is how two
 * companies ended up in production unable to do anything.
 *
 * The picker component lives next door in PortalAccountPicker.tsx; everything
 * that is not a component lives here so fast refresh keeps working.
 */

import { useEffect, useState } from 'react'
import { createOperationalUser, fetchOperationalUsers, type OperationalUser } from '@/services/userService'

export type PortalAccountMode = 'new' | 'existing' | 'none'

export interface PortalAccountChoice {
  mode: PortalAccountMode
  /** Set when mode is 'existing'. */
  profileId: string | null
  /** Set when mode is 'new'. */
  password: string
}

export const EMPTY_PORTAL_ACCOUNT: PortalAccountChoice = {
  mode: 'new',
  profileId: null,
  password: '',
}

/** Active contractor logins. Empty while loading, or if the call fails. */
export function useContractorAccounts() {
  const [accounts, setAccounts] = useState<OperationalUser[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchOperationalUsers().then(({ data }) => {
      if (cancelled) return
      setAccounts(data.filter((user) => user.role === 'contractor' && user.is_active))
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { accounts, loaded }
}

/**
 * Turns the choice into the `profile_id` to store, creating the login first when
 * that is what was asked for. Returns an error string the caller can show as-is.
 */
export async function resolvePortalAccount(
  choice: PortalAccountChoice,
  params: { email: string; fullName: string },
  t: (key: string) => string,
): Promise<{ profileId: string | null; error: string | null }> {
  if (choice.mode === 'none') return { profileId: null, error: null }

  if (choice.mode === 'existing') {
    if (!choice.profileId) return { profileId: null, error: t('compliance.account.chooseRequired') }
    return { profileId: choice.profileId, error: null }
  }

  const email = params.email.trim()
  if (!email || !choice.password) {
    return { profileId: null, error: t('compliance.wizard.accountFieldsRequired') }
  }

  const { data: users, error } = await createOperationalUser({
    email,
    fullName: params.fullName.trim(),
    password: choice.password,
    role: 'contractor',
  })
  if (error) return { profileId: null, error }

  const profileId = users.find((user) => user.email === email)?.id ?? null
  // A login that was created but cannot be found is worse than none: the entity
  // would look linked and behave as if it were not.
  if (!profileId) return { profileId: null, error: t('compliance.account.createdButNotFound') }
  return { profileId, error: null }
}
