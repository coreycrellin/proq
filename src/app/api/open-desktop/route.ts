import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

/**
 * POST /api/open-desktop
 *
 * Opens the proq Electron desktop app. Tries the installed .app first,
 * falls back to launching electron-vite dev from the desktop directory.
 */
export async function POST() {
  // Try installed app first
  const installed = [
    "/Applications/proq.app",
    join(process.env.HOME || "~", "Applications/proq.app"),
  ].find((p) => existsSync(p));

  if (installed) {
    spawn("open", ["-a", installed], { detached: true, stdio: "ignore" }).unref();
    return NextResponse.json({ ok: true, method: "app" });
  }

  // Fall back to dev mode — launch from desktop directory
  const desktopDir = join(process.cwd(), "desktop");
  if (existsSync(join(desktopDir, "package.json"))) {
    spawn("npm", ["run", "dev"], {
      cwd: desktopDir,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, ELECTRON_RENDERER_URL: undefined },
    }).unref();
    return NextResponse.json({ ok: true, method: "dev" });
  }

  return NextResponse.json({ error: "Desktop app not found" }, { status: 404 });
}
