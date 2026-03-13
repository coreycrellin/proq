import { NextResponse } from "next/server";
import { getProject, updateProject, deleteProject } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/task-events";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  // Strip internal _source flag before persisting
  const { _source, ...fields } = body;
  const updated = await updateProject(id, fields);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Emit SSE for agent-initiated project changes (e.g. set_live_url)
  if (_source === "agent") {
    emitProjectUpdate(id, fields);
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const deleted = await deleteProject(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
