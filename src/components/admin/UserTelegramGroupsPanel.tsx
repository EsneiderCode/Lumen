import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import {
  fetchGroups,
  fetchUserGroupIds,
  setUserGroup,
  type TelegramGroup,
} from '@/services/telegramGroupService'

interface UserTelegramGroupsPanelProps {
  userId: string
}

/**
 * Per-user Telegram group membership editor shown in the user form while
 * editing. Notifications about events concerning this user are delivered only
 * to the groups selected here (falling back to the event mappings in Settings
 * when the user has no groups).
 */
export function UserTelegramGroupsPanel({ userId }: UserTelegramGroupsPanelProps) {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<TelegramGroup[]>([])
  const [memberGroupIds, setMemberGroupIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const [allGroups, userGroupIds] = await Promise.all([
          fetchGroups(),
          fetchUserGroupIds(userId),
        ])
        if (cancelled) return
        setGroups(allGroups.filter((group) => group.is_active))
        setMemberGroupIds(new Set(userGroupIds))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t('common.error'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [userId, t])

  async function toggleGroup(group: TelegramGroup) {
    setError(null)
    const isMember = memberGroupIds.has(group.id)
    try {
      await setUserGroup(userId, group.id, !isMember)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      return
    }
    setMemberGroupIds((current) => {
      const next = new Set(current)
      if (isMember) next.delete(group.id)
      else next.add(group.id)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="rounded-l border border-line bg-bg-1 p-4">
        <div className="flex items-center justify-center py-6">
          <div className="nx-loader" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-l border border-line bg-bg-1 p-4">
      <div className="mb-4 border-b border-line pb-3">
        <p className="flex items-center gap-2 font-medium text-fg-1">
          <Send size={15} strokeWidth={1.5} />
          {t('users.telegramGroupsTitle')}
        </p>
        <p className="text-xs text-fg-2">{t('users.telegramGroupsHint')}</p>
      </div>

      {error && (
        <div className="mb-3 rounded-s border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
          {error}
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-fg-2">{t('users.telegramGroupsEmpty')}</p>
      ) : (
        <div className="space-y-1">
          {groups.map((group) => (
            <label key={group.id} className="flex cursor-pointer items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={memberGroupIds.has(group.id)}
                onChange={() => toggleGroup(group)}
                className="h-4 w-4 rounded-s border-line bg-bg-2"
              />
              <span className="text-sm text-fg-1">{group.name}</span>
              <span className="font-mono text-xs text-fg-3">
                {t(`settings.telegram.purposes.${group.purpose}`)}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
