import { NextResponse } from "next/server";
import { getTask } from "@/lib/db";
import { dispatchTask, isTaskDispatched } from "@/lib/agent-dispatch";

type Params = { params: Promise<{ id: string; taskId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id, taskId } = await params;
  const task = await getTask(id, taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status !== "in-progress" || !task.locked) {
    return NextResponse.json({ error: "Task is not queued" }, { status: 400 });
  }

  if (isTaskDispatched(task.id)) {
    return NextResponse.json({ error: "Task is already dispatched" }, { status: 400 });
  }

  const terminalTabId = await dispatchTask(id, taskId, task.title, task.description, task.mode);

  return NextResponse.json({ success: true, terminalTabId });
}
