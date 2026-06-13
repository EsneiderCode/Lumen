import { useEffect } from 'react'

type Theme = 'light' | 'dark'

function isDaytime(): boolean {
  const hour = new Date().getHours()
  return hour >= 6 && hour < 18
}

function applyTheme(theme: Theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#F5F3EE' : '#000000')
  }
}

/**
 * Auto-applies light theme during daytime (06:00–18:00 local time),
 * dark theme at night. Re-checks every 60 seconds.
 */
export function useTheme() {
  useEffect(() => {
    applyTheme(isDaytime() ? 'light' : 'dark')

    const interval = setInterval(() => {
      applyTheme(isDaytime() ? 'light' : 'dark')
    }, 60_000)

    return () => clearInterval(interval)
  }, [])
}
