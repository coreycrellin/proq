import { useEffect, useState } from 'react'
import logoAnimationRepeat from './assets/LogoAnimationRepeat.svg'

interface SplashProps {
  onSettings?: () => void
}

function friendlyStatus(line: string, port: number, wsPort: number): string | null {
  const t = line.trim()
  if (!t) return null
  if (t.includes('WS server')) return `Starting WebSocket on port ${wsPort}...`
  if (t.includes('Ready in') || t.includes('ready started')) return 'Almost ready...'
  if (t.includes('Listening') || t.includes('started server')) return `Starting server on port ${port}...`
  if (t.includes('Compiling') || t.includes('compiling')) return 'Compiling...'
  if (t.includes('Loading')) return 'Loading...'
  // Strip leading > and other noise
  const clean = t.replace(/^[>\s▲⚠]+/, '').trim()
  if (clean) return clean.slice(0, 60)
  return null
}

export function Splash({ onSettings }: SplashProps): React.JSX.Element {
  const [status, setStatus] = useState('Starting server...')
  const [error, setError] = useState<string | null>(null)
  const isPortError =
    error?.includes('already in use') || error?.includes('EADDRINUSE') || false

  useEffect(() => {
    let port = 1337
    let wsPort = 42069

    window.proqDesktop.getConfig().then((config) => {
      port = config.port
      wsPort = config.wsPort
    })

    const cleanupLog = window.proqDesktop.onServerLog((_e, line) => {
      const friendly = friendlyStatus(line, port, wsPort)
      if (friendly) setStatus(friendly)
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
      <img
        className="splash-logo"
        src={logoAnimationRepeat}
        alt="proq"
      />

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
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{status}</p>
      )}
    </div>
  )
}
