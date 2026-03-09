import { NextResponse } from "next/server";
import { spawn, ChildProcess } from "child_process";

let tunnelProcess: ChildProcess | null = null;
let tunnelUrl: string | null = null;
let tunnelError: string | null = null;
let tunnelStarting = false;

/** GET — check tunnel status */
export async function GET() {
  // Check if process is still alive
  if (tunnelProcess && tunnelProcess.exitCode !== null) {
    tunnelProcess = null;
    tunnelUrl = null;
    tunnelStarting = false;
  }

  return NextResponse.json({
    active: !!tunnelProcess && !!tunnelUrl,
    starting: tunnelStarting,
    url: tunnelUrl,
    error: tunnelError,
  });
}

/** POST — start tunnel */
export async function POST() {
  tunnelError = null;

  // Already running
  if (tunnelProcess && tunnelProcess.exitCode === null && tunnelUrl) {
    return NextResponse.json({ url: tunnelUrl, active: true });
  }

  // Already starting
  if (tunnelStarting) {
    return NextResponse.json({ starting: true });
  }

  // Kill any stale process
  if (tunnelProcess) {
    tunnelProcess.kill();
    tunnelProcess = null;
    tunnelUrl = null;
  }

  tunnelStarting = true;

  const port = process.env.PORT || 1337;

  try {
    const proc = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    tunnelProcess = proc;

    // cloudflared prints the URL to stderr
    let urlFound = false;

    const onData = (data: Buffer) => {
      const text = data.toString();
      // cloudflared outputs something like: | https://xxx-xxx-xxx.trycloudflare.com |
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !urlFound) {
        urlFound = true;
        tunnelUrl = match[0] + "/mobile";
        tunnelStarting = false;
        tunnelError = null;
      }
    };

    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);

    proc.on("error", (err) => {
      tunnelStarting = false;
      tunnelProcess = null;
      tunnelUrl = null;
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        tunnelError = "cloudflared not found. Install it with: brew install cloudflared";
      } else {
        tunnelError = `Failed to start tunnel: ${err.message}`;
      }
    });

    proc.on("exit", () => {
      tunnelStarting = false;
      tunnelProcess = null;
      tunnelUrl = null;
    });

    // Wait up to 5s for a quick start, otherwise return starting: true and let client poll
    const started = await new Promise<boolean>((resolve) => {
      const check = setInterval(() => {
        if (tunnelUrl) {
          clearInterval(check);
          resolve(true);
        }
        if (tunnelError) {
          clearInterval(check);
          resolve(false);
        }
      }, 200);
      setTimeout(() => {
        clearInterval(check);
        resolve(!!tunnelUrl);
      }, 5000);
    });

    if (tunnelError) {
      return NextResponse.json({ error: tunnelError }, { status: 500 });
    }

    if (started) {
      return NextResponse.json({ url: tunnelUrl, active: true });
    }

    // Still starting — don't kill the process, let client poll GET for status
    return NextResponse.json({ starting: true });
  } catch (err) {
    tunnelStarting = false;
    const msg = err instanceof Error ? err.message : "Unknown error";
    tunnelError = msg;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE — stop tunnel */
export async function DELETE() {
  if (tunnelProcess) {
    tunnelProcess.kill();
    tunnelProcess = null;
    tunnelUrl = null;
    tunnelStarting = false;
    tunnelError = null;
  }
  return NextResponse.json({ active: false });
}
