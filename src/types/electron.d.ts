interface UpdateCheckResult {
  available: boolean
  commits: string[]
  error?: string
}

interface ProqDesktopAPI {
  checkUpdates: () => Promise<UpdateCheckResult>
  applyAndRestart: () => Promise<{ ok: boolean; error?: string }>
  onUpdateAvailable: (cb: (e: unknown, result: UpdateCheckResult) => void) => () => void
}

interface Window {
  proqDesktop?: ProqDesktopAPI
}
