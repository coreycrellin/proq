import { NextResponse } from "next/server";
import { exec } from "child_process";
import { getProject } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  exec(`open ${JSON.stringify(project.path)}`);

  return NextResponse.json({ ok: true });
}
