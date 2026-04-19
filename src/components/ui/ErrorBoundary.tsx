import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center nexus-bg p-6">
        <div className="w-full max-w-md rounded-l border border-line bg-bg-1 p-8">
          {/* Icon */}
          <div className="mb-6 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12 text-err"
            >
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>

          {/* Heading */}
          <h1 className="mb-2 text-center font-display text-xl font-bold text-fg-1">
            Unerwarteter Fehler
          </h1>
          <p className="mb-1 text-center text-sm text-fg-2">
            Ein Fehler ist aufgetreten. Bitte laden Sie die Seite neu.
          </p>

          {/* Error detail */}
          <p className="mb-6 text-center font-mono text-xs text-fg-4">
            {this.state.error.message}
          </p>

          {/* Reload button */}
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-s border border-accent bg-accent/10 px-4 py-3 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
          >
            Seite neu laden
          </button>
        </div>
      </div>
    )
  }
}
