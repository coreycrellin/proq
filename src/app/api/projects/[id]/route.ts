import { NextResponse } from "next/server";
import { getProject, updateProject, deleteProject } from "@/lib/db";

type Params = { params: { id: string } };

export async function GET(_request: Request, { params }: Params) {
  const project = await getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PATCH(request: Request, { params }: Params) {
  const body = await request.json();
  const updated = await updateProject(params.id, body);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const deleted = await deleteProject(params.id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
