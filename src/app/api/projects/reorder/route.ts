import { NextResponse } from "next/server";
import { reorderProjects } from "@/lib/db";

export async function PUT(request: Request) {
  const body = await request.json();
  const { orderedIds } = body;

  if (!Array.isArray(orderedIds)) {
    return NextResponse.json(
      { error: "orderedIds array is required" },
      { status: 400 }
    );
  }

  await reorderProjects(orderedIds);
  return NextResponse.json({ success: true });
}
