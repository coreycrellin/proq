import { NextResponse } from "next/server";
import { execSync, spawn } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
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
  const { message } = await request.json();

  if (!message?.trim()) {
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

  if (!existsSync(jsonlPath)) {
    return NextResponse.json({ error: "No session file found" }, { status: 400 });
  }

  // If the agent's tmux session is still alive, write a pending reply file
  // for the bridge to pick up after the current process exits
  const pendingReplyPath = `/tmp/proq/${tmuxSession}.pending-reply`;
  if (isSessionAlive(tmuxSession)) {
    writeFileSync(pendingReplyPath, message, "utf-8");
    console.log(`[reply] queued pending reply for task ${shortId} (agent still running)`);
    return NextResponse.json({ success: true, queued: true });
  }

  // Extract session_id from the jsonl file (first system event)
  let sessionId: string | null = null;
  try {
    const content = readFileSync(jsonlPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed);
        if (event.session_id) {
          sessionId = event.session_id;
          break;
        }
      } catch {
        // skip non-JSON lines
      }
    }
  } catch {
    // couldn't read file
  }

  // Build the follow-up command
  const promptDir = join(tmpdir(), "proq-prompts");
  mkdirSync(promptDir, { recursive: true });

  const replyPromptFile = join(promptDir, `${tmuxSession}-reply.md`);
  writeFileSync(replyPromptFile, message, "utf-8");

  const resumeFlag = sessionId ? `--resume '${sessionId}'` : "-c";
  const launcherFile = join(promptDir, `${tmuxSession}-reply.sh`);
  writeFileSync(
    launcherFile,
    `#!/bin/bash\nexec env -u CLAUDECODE -u PORT ${CLAUDE} ${resumeFlag} -p --verbose --output-format stream-json --dangerously-skip-permissions "$(cat '${replyPromptFile}')" >> '${jsonlPath}' 2>&1\n`,
    "utf-8",
  );

  // Clean env for the child
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.PORT;

  const child = spawn("bash", [launcherFile], {
    cwd: effectivePath,
    env,
    stdio: ["ignore", "ignore", "ignore"],
    detached: true,
  });
  child.unref();

  console.log(
    `[reply] spawned follow-up for task ${shortId} (session: ${sessionId || "none"})`,
  );

  return NextResponse.json({ success: true });
}
