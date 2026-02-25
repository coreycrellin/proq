import { NextResponse } from "next/server";
import { getTerminalState, setTerminalState } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const state = await getTerminalState(id);
  return NextResponse.json(state);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  await setTerminalState(id, body);
  const state = await getTerminalState(id);
  return NextResponse.json(state);
}
