import { NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/db";
import { rename } from "fs/promises";
import path from "path";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  const body = await request.json();
  const { name } = body;

  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  const project = await getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parentDir = path.dirname(project.path);
  const newPath = path.join(parentDir, name.trim());

  // Rename the directory on disk
  try {
    await rename(project.path, newPath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to rename directory: ${message}` },
      { status: 500 }
    );
  }

  // Update the project record
  const updated = await updateProject(params.id, {
    name: name.trim(),
    path: newPath,
  });

  return NextResponse.json(updated);
}
