import { useEffect, useState } from 'react'

const STORAGE_KEY = 'lumen-lernmodus-v1'
const EVENT_NAME = 'lumen:lernmodus-change'

function readStored(): boolean {
  if (typeof window === 'undefined') return false
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return true
  return raw === '1'
}

function persist(on: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  window.dispatchEvent(new CustomEvent<boolean>(EVENT_NAME, { detail: on }))
}

export function useLernmodus(): { on: boolean; toggle: () => void; set: (on: boolean) => void } {
  const [on, setOn] = useState<boolean>(readStored)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail
      if (typeof detail === 'boolean') setOn(detail)
    }
    window.addEventListener(EVENT_NAME, handler)
    return () => window.removeEventListener(EVENT_NAME, handler)
  }, [])

  return {
    on,
    toggle: () => persist(!on),
    set: (next: boolean) => persist(next),
  }
}
