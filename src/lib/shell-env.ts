/**
 * Resolve the user's interactive login shell PATH so child processes
 * (tmux, claude, etc.) see the same environment as the user's terminal.
 *
 * Next.js server processes often inherit a stripped-down PATH that
 * doesn't include paths like /usr/local/bin, nvm shims, or homebrew.
 */
import { execSync } from "child_process";

let cachedPath: string | null = null;

function resolveLoginPath(): string {
  const shell = process.env.SHELL || "/bin/zsh";
  try {
    // Run a login shell to get the full PATH
    const result = execSync(`${shell} -l -c 'echo $PATH'`, {
      timeout: 5_000,
      encoding: "utf-8",
      env: { ...process.env, PATH: "/usr/bin:/bin" },
    }).trim();
    if (result) return result;
  } catch {}
  return process.env.PATH || "/usr/bin:/bin";
}

/** Full PATH from the user's login shell (cached after first call). */
export function getUserPath(): string {
  if (cachedPath === null) {
    cachedPath = resolveLoginPath();
  }
  return cachedPath;
}

/** Env object suitable for passing to execSync / spawn. */
export function shellEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: getUserPath() };
}
