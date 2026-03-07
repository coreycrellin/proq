import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { statSync, mkdirSync, copyFileSync } from "fs";
import path from "path";
import os from "os";

const DATA_DIR = path.join(process.cwd(), "data");

export async function GET() {
  const desktop = path.join(os.homedir(), "Desktop");

  let result: string;
  try {
    result = execSync(
      `osascript -e 'set theFiles to choose file with prompt "Select files to attach" default location POSIX file "${desktop}" with multiple selections allowed' -e 'set output to ""' -e 'repeat with f in theFiles' -e 'set output to output & POSIX path of f & linefeed' -e 'end repeat' -e 'return output'`,
      { timeout: 120000, encoding: "utf-8" }
    ).trim();
  } catch {
    // User cancelled or error
    return NextResponse.json([]);
  }

  if (!result) {
    return NextResponse.json([]);
  }

  const filePaths = result.split("\n").filter(Boolean);

  const attachments = filePaths.map((srcPath) => {
    const name = path.basename(srcPath);
    const st = statSync(srcPath);
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const dir = path.join(DATA_DIR, "attachments", id);
    mkdirSync(dir, { recursive: true });
    const destPath = path.join(dir, name);
    copyFileSync(srcPath, destPath);

    const ext = path.extname(name).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".bmp": "image/bmp",
      ".tiff": "image/tiff",
      ".heic": "image/heic",
      ".pdf": "application/pdf",
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".json": "application/json",
      ".csv": "text/csv",
    };

    return {
      id,
      name,
      size: st.size,
      type: mimeMap[ext] || "application/octet-stream",
      filePath: destPath,
    };
  });

  return NextResponse.json(attachments);
}
