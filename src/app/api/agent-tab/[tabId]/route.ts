import { NextResponse } from "next/server";
import { clearAgentTabSession } from "@/lib/agent-tab-runtime";

type Params = { params: Promise<{ tabId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const { tabId } = await params;
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  await clearAgentTabSession(tabId, projectId);
  return NextResponse.json({ success: true });
}
