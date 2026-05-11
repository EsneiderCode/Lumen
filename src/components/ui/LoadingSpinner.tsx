export function LoadingSpinner() {
  return (
    <div className="flex h-screen items-center justify-center" role="status" aria-label="Wird geladen">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-accent" aria-hidden="true" />
    </div>
  )
}
