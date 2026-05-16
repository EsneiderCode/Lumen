export function LoadingSpinner() {
  return (
    <div className="nx-app-shell flex h-screen items-center justify-center" role="status" aria-label="Wird geladen">
      <div className="panel px-8 py-6 text-center">
        <div className="nx-loader mx-auto" aria-hidden="true" />
        <div className="nx-label mt-4">[LOADING]</div>
      </div>
    </div>
  )
}
