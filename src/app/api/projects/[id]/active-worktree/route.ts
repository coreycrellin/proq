import { NextResponse } from "next/server";
import { setActiveWorktreeTaskId } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  await setActiveWorktreeTaskId(id, body.taskId ?? null);
  return NextResponse.json({ success: true });
}
