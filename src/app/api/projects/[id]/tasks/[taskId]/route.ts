import { NextResponse } from "next/server";
import { getTask, updateTask, deleteTask } from "@/lib/db";
import { dispatchTask, abortTask } from "@/lib/agent-dispatch";

type Params = { params: { id: string; taskId: string } };

export async function PATCH(request: Request, { params }: Params) {
  const body = await request.json();

  // Check for status transitions before applying update
  const prevTask = await getTask(params.id, params.taskId);

  const updated = await updateTask(params.id, params.taskId, body);
  if (!updated) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Dispatch/abort on status change
  if (prevTask && body.status && prevTask.status !== body.status) {
    if (body.status === "in-progress" && prevTask.status !== "in-progress") {
      await updateTask(params.id, params.taskId, { locked: true });
      updated.locked = true;
      dispatchTask(params.id, params.taskId, updated.title, updated.description);
    } else if (prevTask.status === "in-progress" && body.status === "todo") {
      await updateTask(params.id, params.taskId, { locked: false });
      updated.locked = false;
      abortTask(params.id, params.taskId);
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const deleted = await deleteTask(params.id, params.taskId);
  if (!deleted) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
