import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getSettings } from "@/lib/db";
import { shellEnv } from "@/lib/shell-env";

function findBinary(name: string, extraPaths: string[] = []): { found: boolean; path: string } {
  // Try `which` using the user's login shell PATH
  try {
    const result = execSync(`which ${name}`, { timeout: 5_000, encoding: "utf-8", env: shellEnv() }).trim();
    if (result && existsSync(result)) {
      return { found: true, path: result };
    }
  } catch {}

  // Try common install locations
  const home = homedir();
  const candidates = [
    `/usr/local/bin/${name}`,
    `${home}/.local/bin/${name}`,
    `${home}/.npm-global/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
  ];

  // Try npm global bin
  try {
    const npmRoot = execSync("npm root -g", { timeout: 5_000, encoding: "utf-8", env: shellEnv() }).trim();
    if (npmRoot) {
      candidates.push(`${npmRoot}/.bin/${name}`);
      // npm global root is node_modules — bin is sibling
      candidates.push(npmRoot.replace(/\/node_modules$/, `/bin/${name}`));
    }
  } catch {}

  // Claude desktop app installs to ~/Library/Application Support/Claude/claude-code/{version}/claude
  if (name === "claude") {
    try {
      const desktopDir = join(home, "Library", "Application Support", "Claude", "claude-code");
      if (existsSync(desktopDir)) {
        const versions = readdirSync(desktopDir).sort().reverse(); // newest version first
        for (const v of versions) {
          candidates.push(join(desktopDir, v, "claude"));
        }
      }
    } catch {}
  }

  for (const p of [...extraPaths, ...candidates]) {
    if (existsSync(p)) {
      return { found: true, path: p };
    }
  }

  return { found: false, path: "" };
}

export async function GET() {
  const settings = await getSettings();

  // If settings has a custom claudeBin, check that first
  let claude: { found: boolean; path: string };
  if (settings.claudeBin && settings.claudeBin !== "claude") {
    if (existsSync(settings.claudeBin)) {
      claude = { found: true, path: settings.claudeBin };
    } else {
      claude = findBinary("claude");
    }
  } else {
    claude = findBinary("claude");
  }

  const tmux = findBinary("tmux");

  return NextResponse.json({
    setupComplete: settings.setupComplete,
    claude,
    tmux,
  });
}
