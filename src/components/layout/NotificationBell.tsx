import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllRead,
  markRead,
  type AppNotification,
} from '@/services/notificationInboxService'

const POLL_MS = 60_000

const LEVEL_DOT: Record<string, string> = {
  info: 'bg-info',
  warn: 'bg-warn',
  err: 'bg-err',
}

function docName(payload: Record<string, unknown>, language: string): string {
  const names = payload.doc_type_name
  if (names && typeof names === 'object') {
    const map = names as Record<string, string>
    return map[language.slice(0, 2)] ?? map.es ?? map.de ?? map.en ?? ''
  }
  return String(payload.doc_type_code ?? '')
}

export function NotificationBell() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const userId = user?.id ?? null

  const refreshCount = useCallback(async () => {
    if (!userId) return
    setUnread(await fetchUnreadCount(userId))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshCount()
    const timer = window.setInterval(() => void refreshCount(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [userId, refreshCount])

  const loadList = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await fetchNotifications(userId)
    setItems(data)
    setLoading(false)
  }, [userId])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next) await loadList()
  }

  async function handleItemClick(n: AppNotification) {
    if (!n.read_at) {
      await markRead(n.id)
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      setUnread((c) => Math.max(0, c - 1))
    }
  }

  async function handleMarkAll() {
    if (!userId) return
    await markAllRead(userId)
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })))
    setUnread(0)
  }

  function bodyFor(n: AppNotification): string {
    const payload = n.payload ?? {}
    return t(`notifications.body.${n.category}`, {
      doc: docName(payload, i18n.language),
      entity: String(payload.entity_name ?? ''),
      days: Number(payload.days ?? 0),
    })
  }

  const bellRef = useRef<HTMLDivElement>(null)

  if (!userId) return null

  return (
    <div ref={bellRef} className="relative">
      <button
        onClick={() => void toggle()}
        className="nx-tb-btn relative"
        aria-label={t('notifications.title')}
      >
        <Bell size={16} strokeWidth={1.5} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] leading-4 text-fg-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-l border border-line bg-bg-1">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-display text-sm font-semibold text-fg-1">{t('notifications.title')}</span>
              {items.some((n) => !n.read_at) && (
                <button
                  onClick={() => void handleMarkAll()}
                  className="font-mono text-xs text-fg-3 transition-colors hover:text-accent"
                >
                  {t('notifications.markAllRead')}
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <p className="px-4 py-6 text-center font-mono text-xs text-fg-3">[LOADING]</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-fg-2">{t('notifications.empty')}</p>
              ) : (
                <ul>
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => void handleItemClick(n)}
                        className={`flex w-full items-start gap-2 border-b border-line px-4 py-3 text-left transition-colors hover:bg-bg-2 ${
                          n.read_at ? 'opacity-60' : ''
                        }`}
                      >
                        <span
                          className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${LEVEL_DOT[n.level] ?? 'bg-info'}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-fg-1">{bodyFor(n)}</span>
                          <span className="mt-0.5 block font-mono text-[10px] text-fg-3">
                            {new Date(n.created_at).toLocaleDateString(
                              i18n.language === 'es' ? 'es-ES' : 'de-DE',
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
