export function OfflineFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-200">
        <span className="text-3xl">📡</span>
      </div>
      <h1 className="mb-2 text-xl font-bold text-gray-900">Sie sind offline</h1>
      <p className="max-w-sm text-sm text-gray-500">
        Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 rounded-lg bg-lumen-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-lumen-primary-light"
      >
        Erneut versuchen
      </button>
    </div>
  )
}
