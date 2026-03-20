import { NextResponse } from "next/server";
import { continueSession } from "@/lib/agent-session";
import { getTask, getProject, updateTask } from "@/lib/db";
import { emitTaskUpdate } from "@/lib/task-events";

type Params = { params: Promise<{ id: string; taskId: string }> };

/**
 * POST /api/projects/[id]/tasks/[taskId]/followup
 *
 * HTTP fallback for sending a follow-up message when WebSocket is unavailable.
 * Calls continueSession directly (instead of the generic task PATCH which
 * goes through processQueue/tmux and never reaches the structured session).
 */
export async function POST(request: Request, { params }: Params) {
  const { id: projectId, taskId } = await params;
  const body = await request.json();
  const { text, attachments } = body;

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const task = await getTask(projectId, taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const project = await getProject(projectId);
  const projectPath = project?.path.replace(/^~/, process.env.HOME || "~") || ".";
  const cwd = task.worktreePath || projectPath;

  // Move task back to in-progress if needed
  if (task.status !== "in-progress") {
    await updateTask(projectId, taskId, { status: "in-progress", agentStatus: "running" });
    emitTaskUpdate(projectId, taskId, { status: "in-progress", agentStatus: "running" });
  } else if (task.agentStatus !== "running") {
    await updateTask(projectId, taskId, { agentStatus: "running" });
    emitTaskUpdate(projectId, taskId, { agentStatus: "running" });
  }

  await continueSession(projectId, taskId, text, cwd, undefined, attachments);
  return NextResponse.json({ ok: true });
}
