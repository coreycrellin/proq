import { NextResponse } from 'next/server';
import { readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.heic',
]);

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.heic': 'image/heic',
};

export async function GET() {
  try {
    const desktopPath = join(homedir(), 'Desktop');
    const entries = await readdir(desktopPath);

    // Filter to image files and get their stats
    const imageFiles: { name: string; path: string; mtimeMs: number }[] = [];
    for (const name of entries) {
      if (name.startsWith('.')) continue;
      const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext)) continue;

      const filePath = join(desktopPath, name);
      const info = await stat(filePath);
      if (!info.isFile()) continue;
      imageFiles.push({ name, path: filePath, mtimeMs: info.mtimeMs });
    }

    if (imageFiles.length === 0) {
      return NextResponse.json({ error: 'No images found on Desktop' }, { status: 404 });
    }

    // Sort by modification time descending (most recent first)
    imageFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const recent = imageFiles[0];

    const ext = recent.name.substring(recent.name.lastIndexOf('.')).toLowerCase();
    const mime = MIME_MAP[ext] || 'image/png';
    const buffer = await readFile(recent.path);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    return NextResponse.json({
      name: recent.name,
      size: buffer.length,
      type: mime,
      dataUrl,
    });
  } catch (err) {
    console.error('[recent-desktop-image] error:', err);
    return NextResponse.json({ error: 'Failed to read Desktop' }, { status: 500 });
  }
}
