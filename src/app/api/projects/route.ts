import { NextResponse } from "next/server";
import { getAllProjects, createProject } from "@/lib/db";

export async function GET() {
  const projects = await getAllProjects();
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, path, serverUrl } = body;

  if (!name || !path) {
    return NextResponse.json(
      { error: "name and path are required" },
      { status: 400 }
    );
  }

  const project = await createProject({ name, path, serverUrl });
  return NextResponse.json(project, { status: 201 });
}
