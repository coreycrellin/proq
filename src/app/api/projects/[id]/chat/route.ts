import { NextResponse } from "next/server";
import { getChatLog, addChatMessage, getProject } from "@/lib/db";

type Params = { params: { id: string } };

export async function GET(_request: Request, { params }: Params) {
  const project = await getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const log = await getChatLog(params.id);
  return NextResponse.json(log);
}

export async function POST(request: Request, { params }: Params) {
  const project = await getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();
  const { role, message, toolCalls } = body;

  if (!role || !message) {
    return NextResponse.json(
      { error: "role and message are required" },
      { status: 400 }
    );
  }

  const entry = await addChatMessage(params.id, { role, message, toolCalls });
  return NextResponse.json(entry, { status: 201 });
}
