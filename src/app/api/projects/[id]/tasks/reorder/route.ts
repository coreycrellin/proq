import { NextResponse } from "next/server";
import { reorderTasks, getProject } from "@/lib/db";

type Params = { params: { id: string } };

export async function PUT(request: Request, { params }: Params) {
  const project = await getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();
  const { items } = body as {
    items: { id: string; order: number; status?: string }[];
  };

  if (!Array.isArray(items)) {
    return NextResponse.json(
      { error: "items array is required" },
      { status: 400 }
    );
  }

  await reorderTasks(params.id, items);
  return NextResponse.json({ success: true });
}
