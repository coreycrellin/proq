import { useEffect, useState } from 'react'

interface SplashProps {
  onSettings?: () => void
}

export function Splash({ onSettings }: SplashProps): React.JSX.Element {
  const [status, setStatus] = useState('Starting server...')
  const [error, setError] = useState<string | null>(null)
  const isPortError =
    error?.includes('already in use') || error?.includes('EADDRINUSE') || false

  useEffect(() => {
    const cleanupLog = window.proqDesktop.onServerLog((_e, line) => {
      const trimmed = line.trim()
      if (trimmed) setStatus(trimmed.slice(0, 60))
    })

    const cleanupError = window.proqDesktop.onServerError((_e, err) => {
      setError(err)
    })

    window.proqDesktop.startServer().then((result) => {
      if (!result.ok) {
        setError(result.error || 'Failed to start server')
      }
    })

    return (): void => {
      cleanupLog()
      cleanupError()
    }
  }, [])

  return (
    <div className="splash-container titlebar-drag">
      <svg
        className="splash-logo"
        viewBox="0 0 256 256"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M36.3813 253V16H219.618V173.41H89.6223V69.6509H165.507V121.235H128.533"
          stroke="#E4BD89"
          strokeWidth="27"
        />
      </svg>

      {error ? (
        <>
          <p style={{ color: 'var(--error)', fontSize: 14, marginBottom: 16, textAlign: 'center', padding: '0 24px' }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            {isPortError && onSettings && (
              <button
                className="btn-primary titlebar-no-drag"
                onClick={onSettings}
              >
                Change Port
              </button>
            )}
            <button
              className="btn-primary titlebar-no-drag"
              onClick={(): void => {
                setError(null)
                setStatus('Restarting...')
                window.proqDesktop.startServer()
              }}
            >
              Retry
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="spinner" style={{ marginBottom: 20 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{status}</p>
        </>
      )}
    </div>
  )
}
