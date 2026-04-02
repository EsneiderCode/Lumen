export function OfflineFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center nexus-bg px-4 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-gf-card-lg bg-gf-border">
        <span className="text-3xl">📡</span>
      </div>
      <h1 className="mb-2 text-xl font-bold text-gf-text">Sie sind offline</h1>
      <p className="max-w-sm text-sm text-gf-text-muted">
        Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 rounded-gf-btn bg-gf-primary px-6 py-2.5 text-sm font-medium text-gf-base hover:bg-gf-primary-light transition-colors"
      >
        Erneut versuchen
      </button>
    </div>
  )
}
