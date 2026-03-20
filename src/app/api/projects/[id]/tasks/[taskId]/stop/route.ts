import { NextResponse } from "next/server";
import { stopSession } from "@/lib/agent-session";

type Params = { params: Promise<{ id: string; taskId: string }> };

/**
 * POST /api/projects/[id]/tasks/[taskId]/stop
 *
 * HTTP fallback for stopping an agent session when WebSocket is unavailable.
 */
export async function POST(_request: Request, { params }: Params) {
  const { taskId } = await params;
  stopSession(taskId);
  return NextResponse.json({ ok: true });
}
