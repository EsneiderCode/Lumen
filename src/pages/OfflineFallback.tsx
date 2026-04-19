import { WifiOff } from 'lucide-react'

export function OfflineFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center nexus-bg px-4 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-card-lg border border-line bg-bg-1">
        <WifiOff size={32} strokeWidth={1.5} className="text-fg-2" />
      </div>
      <h1 className="mb-2 text-xl font-bold text-fg-1">Sie sind offline</h1>
      <p className="max-w-sm text-sm text-fg-2">
        Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 rounded-btn bg-accent px-6 py-2.5 text-sm font-medium text-paper hover:bg-accent transition-colors"
      >
        Erneut versuchen
      </button>
    </div>
  )
}
