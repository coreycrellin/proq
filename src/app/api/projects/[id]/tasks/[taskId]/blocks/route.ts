import { NextResponse } from "next/server";
import { getTask } from "@/lib/db";
import { getSession } from "@/lib/agent-session";

type Params = { params: Promise<{ id: string; taskId: string }> };

/**
 * GET /api/projects/[id]/tasks/[taskId]/blocks?after=N
 *
 * Returns agent blocks for a task. Used as HTTP polling fallback
 * when WebSocket is unreachable (e.g. through a Cloudflare tunnel).
 *
 * Query params:
 *   after - return only blocks after this index (for incremental polling)
 */
export async function GET(request: Request, { params }: Params) {
  const { id, taskId } = await params;
  const url = new URL(request.url);
  const after = parseInt(url.searchParams.get("after") || "0", 10);

  // Prefer in-memory session (live, most up-to-date)
  const session = getSession(taskId);
  if (session) {
    const blocks = after > 0 ? session.blocks.slice(after) : session.blocks;
    const isDone = session.status === "done" || session.status === "error";
    return NextResponse.json({
      blocks,
      total: session.blocks.length,
      done: isDone,
    });
  }

  // Fall back to DB
  const task = await getTask(id, taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const allBlocks = task.agentBlocks || [];
  const blocks = after > 0 ? allBlocks.slice(after) : allBlocks;
  const isRunning = task.agentStatus === "running" || task.agentStatus === "starting";

  return NextResponse.json({
    blocks,
    total: allBlocks.length,
    done: !isRunning,
  });
}
