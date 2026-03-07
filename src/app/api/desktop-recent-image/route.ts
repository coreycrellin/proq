import { NextResponse } from "next/server";
import { readdirSync, statSync, mkdirSync, copyFileSync } from "fs";
import path from "path";
import os from "os";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".heic"]);
const DATA_DIR = path.join(process.cwd(), "data");

export async function GET() {
  const desktop = path.join(os.homedir(), "Desktop");

  let entries: { name: string; mtimeMs: number }[];
  try {
    entries = readdirSync(desktop)
      .filter((name) => IMAGE_EXTS.has(path.extname(name).toLowerCase()))
      .map((name) => {
        const st = statSync(path.join(desktop, name));
        return { name, mtimeMs: st.mtimeMs };
      });
  } catch {
    return NextResponse.json({ error: "Cannot read Desktop" }, { status: 500 });
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "No images found on Desktop" }, { status: 404 });
  }

  entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const newest = entries[0];
  const srcPath = path.join(desktop, newest.name);
  const st = statSync(srcPath);

  // Copy into attachments directory so it's servable
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const dir = path.join(DATA_DIR, "attachments", id);
  mkdirSync(dir, { recursive: true });
  const destPath = path.join(dir, newest.name);
  copyFileSync(srcPath, destPath);

  const ext = path.extname(newest.name).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".heic": "image/heic",
  };

  return NextResponse.json({
    id,
    name: newest.name,
    size: st.size,
    type: mimeMap[ext] || "image/png",
    filePath: destPath,
  });
}
