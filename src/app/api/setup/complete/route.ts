import { NextResponse } from "next/server";
import { updateSettings } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const claudeBin = body.claudeBin?.trim() || "claude";

  const updated = await updateSettings({
    claudeBin,
    setupComplete: true,
  });

  return NextResponse.json(updated);
}
