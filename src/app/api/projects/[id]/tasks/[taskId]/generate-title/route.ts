import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getTask } from "@/lib/db";

const CLAUDE = process.env.CLAUDE_BIN || "claude";
const MC_API = "http://localhost:1337";

type Params = { params: Promise<{ id: string; taskId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id, taskId } = await params;

  const task = await getTask(id, taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (!task.description?.trim()) {
    return NextResponse.json({ error: "No description" }, { status: 400 });
  }

  // Already has a title
  if (task.title?.trim()) {
    return NextResponse.json({ title: task.title });
  }

  const desc = task.description.trim().slice(0, 2000);
  const prompt = `Generate a concise 3-8 word title for the following task. Reply with ONLY the title text, no quotes, no extra punctuation.\n\nTask:\n${desc}`;

  // Write prompt and launcher script to temp files
  const promptDir = join(tmpdir(), "proq-prompts");
  mkdirSync(promptDir, { recursive: true });

  const shortId = taskId.slice(0, 8);
  const promptFile = join(promptDir, `title-${shortId}.md`);
  writeFileSync(promptFile, prompt, "utf-8");

  // Launcher: run claude, capture output, curl it back as a PATCH
  const launcherFile = join(promptDir, `title-${shortId}.sh`);
  const logFile = join(promptDir, `title-${shortId}.log`);
  writeFileSync(
    launcherFile,
    `#!/bin/bash
exec > '${logFile}' 2>&1
echo "[generate-title] starting for ${shortId}"
title=$(env -u CLAUDECODE -u PORT ${CLAUDE} -p "$(cat '${promptFile}')" 2>&1)
echo "[generate-title] raw output: $title"
# Strip surrounding quotes
title=$(echo "$title" | sed 's/^["'"'"'"]//;s/["'"'"'"]$//')
title=$(echo "$title" | head -1 | xargs)
if [ -n "$title" ]; then
  # Escape double quotes for JSON
  escaped=$(echo "$title" | sed 's/"/\\\\"/g')
  curl -s -X PATCH '${MC_API}/api/projects/${id}/tasks/${taskId}' \\
    -H 'Content-Type: application/json' \\
    -d "{\\"title\\":\\"$escaped\\"}"
  echo "[generate-title] saved: $title"
else
  echo "[generate-title] empty result"
fi
rm -f '${promptFile}' '${launcherFile}'
`,
    "utf-8",
  );

  // Spawn in background — returns immediately
  const child = spawn("bash", [launcherFile], {
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  console.log(`[generate-title] spawned background job for task ${shortId}`);
  return NextResponse.json({ success: true, generating: true });
}
