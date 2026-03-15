/**
 * macOS GUI apps don't inherit the user's shell PATH.
 * Prepend common binary directories so spawn('npm', ...) etc. work.
 */

import fs from 'fs'

const COMMON_DIRS = [
  '/opt/homebrew/bin',       // Homebrew (Apple Silicon)
  '/usr/local/bin',          // Homebrew (Intel)
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin'
]

export function ensurePath(): void {
  const dirs = [...COMMON_DIRS]

  // Check for nvm — use the latest installed node version
  const nvmDir = process.env.NVM_DIR || `${process.env.HOME}/.nvm`
  try {
    const versions = fs.readdirSync(`${nvmDir}/versions/node`).sort().reverse()
    if (versions.length) dirs.unshift(`${nvmDir}/versions/node/${versions[0]}/bin`)
  } catch {
    // no nvm
  }

  const current = process.env.PATH || ''
  const currentSet = new Set(current.split(':'))
  const missing = dirs.filter((d) => !currentSet.has(d))

  if (missing.length) {
    process.env.PATH = [...missing, current].join(':')
  }
}
