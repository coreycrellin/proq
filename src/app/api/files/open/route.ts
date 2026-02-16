import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import { getAllProjects } from "@/lib/db";

const ALLOWED_APPS: Record<string, string> = {
  cursor: "Cursor",
  vscode: "Visual Studio Code",
  terminal: "Terminal",
  warp: "Warp",
  iterm: "iTerm",
  finder: "Finder",
  zed: "Zed",
};

export async function GET() {
  return NextResponse.json({ apps: Object.keys(ALLOWED_APPS) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { app, path: targetPath } = body;

  if (!app || !targetPath) {
    return NextResponse.json(
      { error: "app and path are required" },
      { status: 400 }
    );
  }

  const resolved = path.resolve(targetPath);

  // Validate path belongs to a registered project
  const projects = await getAllProjects();
  const isAllowed = projects.some((p) => resolved.startsWith(p.path));
  if (!isAllowed) {
    return NextResponse.json({ error: "path not allowed" }, { status: 403 });
  }

  const appName = ALLOWED_APPS[app];
  if (!appName) {
    return NextResponse.json({ error: "app not allowed" }, { status: 400 });
  }

  return new Promise<NextResponse>((resolve) => {
    exec(`open -a "${appName}" "${resolved}"`, (error) => {
      if (error) {
        resolve(
          NextResponse.json(
            { error: `Failed to open: ${error.message}` },
            { status: 500 }
          )
        );
      } else {
        resolve(NextResponse.json({ ok: true }));
      }
    });
  });
}
