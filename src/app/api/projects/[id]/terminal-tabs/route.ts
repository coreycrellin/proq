import { NextResponse } from "next/server";
import { getTerminalTabs, setTerminalTabs } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const tabs = await getTerminalTabs(id);
  return NextResponse.json({ tabs });
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const tabs = Array.isArray(body.tabs) ? body.tabs : [];
  await setTerminalTabs(id, tabs);
  return NextResponse.json({ tabs });
}
