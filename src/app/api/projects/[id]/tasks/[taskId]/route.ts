import { NextResponse } from "next/server";
import { updateTask, deleteTask } from "@/lib/db";

type Params = { params: { id: string; taskId: string } };

export async function PATCH(request: Request, { params }: Params) {
  const body = await request.json();
  const updated = await updateTask(params.id, params.taskId, body);
  if (!updated) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
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
