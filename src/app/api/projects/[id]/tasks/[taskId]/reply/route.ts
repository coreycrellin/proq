import { NextResponse } from "next/server";
import { execSync, spawn } from "child_process";
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getTask, getAllProjects } from "@/lib/db";

const CLAUDE = process.env.CLAUDE_BIN || "claude";

type Params = { params: Promise<{ id: string; taskId: string }> };

function isSessionAlive(tmuxSession: string): boolean {
  try {
    execSync(`tmux has-session -t '${tmuxSession}'`, { timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id, taskId } = await params;
  const { message, attachments } = await request.json();

  if (!message?.trim() && (!attachments || attachments.length === 0)) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const task = await getTask(id, taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Determine working directory
  const projects = await getAllProjects();
  const project = projects.find((p) => p.id === id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const projectPath = project.path.replace(/^~/, process.env.HOME || "~");
  const effectivePath = task.worktreePath || projectPath;

  if (!existsSync(effectivePath)) {
    return NextResponse.json({ error: "Project path not found" }, { status: 400 });
  }

  const shortId = taskId.slice(0, 8);
  const tmuxSession = `mc-${shortId}`;
  const jsonlPath = `/tmp/proq/${tmuxSession}.jsonl`;
  const pendingReplyPath = `/tmp/proq/${tmuxSession}.pending-reply`;
  const promptDir = join(tmpdir(), "proq-prompts");
  mkdirSync(promptDir, { recursive: true });
  mkdirSync("/tmp/proq", { recursive: true });

  // Write image attachments to temp files so the agent can read them
  let messageWithImages = message || "";
  if (attachments?.length) {
    const attachDir = join(tmpdir(), "proq-prompts", `${tmuxSession}-attachments`);
    mkdirSync(attachDir, { recursive: true });
    const imageFiles: string[] = [];
    for (const att of attachments) {
      if (att.dataUrl && att.type?.startsWith("image/")) {
        const match = att.dataUrl.match(/^data:[^;]+;base64,(.+)$/);
        if (match) {
          const filePath = join(attachDir, att.name);
          writeFileSync(filePath, Buffer.from(match[1], "base64"));
          imageFiles.push(filePath);
        }
      }
    }
    if (imageFiles.length > 0) {
      messageWithImages += `\n\n## Attached Images\nThe following image files are attached. Use your Read tool to view them:\n${imageFiles.map((f) => `- ${f}`).join("\n")}`;
    }
  }

  // If the jsonl file doesn't exist, try to recreate from agentLog
  if (!existsSync(jsonlPath)) {
    if (task.agentLog?.trimStart().startsWith("{")) {
      writeFileSync(jsonlPath, task.agentLog + "\n", "utf-8");
    } else {
      // No history to restore — create empty file
      writeFileSync(jsonlPath, "", "utf-8");
    }
  }

  // Append user follow-up event to jsonl for history persistence
  appendFileSync(
    jsonlPath,
    JSON.stringify({ type: "user-follow-up", message }) + "\n",
    "utf-8",
  );

  // If the agent's tmux session is still alive, write a pending reply file
  // for the bridge to pick up after the current process exits
  if (isSessionAlive(tmuxSession)) {
    writeFileSync(pendingReplyPath, messageWithImages, "utf-8");
    console.log(`[reply] queued pending reply for task ${shortId} (agent still running)`);
    return NextResponse.json({ success: true, queued: true });
  }

  // Session is dead — restart the bridge in a new tmux session
  console.log(`[reply] session ${tmuxSession} is dead, restarting bridge for reply`);

  // Write pending-reply for the bridge to pick up after the no-op launcher exits
  writeFileSync(pendingReplyPath, messageWithImages, "utf-8");

  // Create a no-op launcher (bridge requires one; it exits immediately)
  const noopLauncher = join(promptDir, `${tmuxSession}-noop.sh`);
  writeFileSync(noopLauncher, "#!/bin/bash\nexit 0\n", "utf-8");

  const bridgePath = join(process.cwd(), "src/lib/proq-bridge.js");
  const socketPath = `/tmp/proq/${tmuxSession}.sock`;

  const tmuxCmd = `tmux new-session -d -s '${tmuxSession}' -c '${effectivePath}' node '${bridgePath}' '${socketPath}' '${noopLauncher}' --json --jsonl '${jsonlPath}'`;

  try {
    execSync(tmuxCmd, { timeout: 10_000 });
    console.log(`[reply] restarted bridge in tmux session ${tmuxSession} for follow-up`);
  } catch (err) {
    console.error(`[reply] failed to restart bridge for ${shortId}:`, err);
    return NextResponse.json(
      { error: "Failed to restart agent session" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, bridgeRestarted: true });
}
